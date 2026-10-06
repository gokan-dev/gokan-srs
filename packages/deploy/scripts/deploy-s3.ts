#!/usr/bin/env bun
// Content-addressed deploy of one site's dist/ to its S3 prefix (gokan-srs at the bucket root,
// gokan-dictionary under dictionary/). See src/deployManifest.ts for why neither the default
// `aws s3 sync` nor `--size-only` is correct here.
//
// Hash every built file, compare against a manifest stored alongside the site in S3, and upload
// only what actually differs. The manifest is written LAST, so an interrupted deploy leaves the
// previous manifest in place and the next run simply redoes the work rather than believing files
// it never uploaded are present. With no manifest, the bucket listing's ETags stand in for it.
//
// Transfers go through the AWS CLI rather than the SDK: it is already installed and
// authenticated on the runner, and it parallelizes a directory upload far better than
// per-file calls would (spawning one `aws` process per file would take hours on a full run).
// Changed files are hardlinked into a staging tree so one recursive upload moves exactly the
// intended set.
//
// Usage: bun packages/deploy/scripts/deploy-s3.ts --site srs|dictionary --bucket <name> [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    SITES,
    contentHash,
    diffManifests,
    isSite,
    manifestFromListing,
    objectKey,
    parseManifest,
    planUploads,
    type BuildManifest,
    type PreviousDeploy,
    type Site,
} from '../src/deployManifest';

const PACKAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.join(PACKAGE_ROOT, '..', '..');
const WORK_DIR = path.join(PACKAGE_ROOT, '.deploy-stage');

const MANIFEST_KEY = '.build-manifest.json';
/** S3 caps a single delete-objects request at 1000 keys. */
const DELETE_BATCH_SIZE = 1000;

interface Args {
    site: Site;
    bucket: string;
    /** Report what would be uploaded and deleted, touching nothing. */
    dryRun: boolean;
}

function parseArgs(): Args {
    const argv = process.argv.slice(2);
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i === -1 ? undefined : argv[i + 1];
    };
    const site = get('--site');
    const bucket = get('--bucket');
    if (!site || !isSite(site) || !bucket) {
        throw new Error(`usage: deploy-s3.ts --site ${Object.keys(SITES).join('|')} --bucket <name> [--dry-run]`);
    }
    return { site, bucket, dryRun: argv.includes('--dry-run') };
}

/**
 * `capture` decides whether the child's stdout is buffered and returned, or streamed straight
 * to this process's own stdout.
 *
 * That distinction is load-bearing, not stylistic. A recursive `aws s3` transfer prints one line
 * per file, so buffering its output for a full run overflows execFileSync's default 1MB stdout
 * buffer, which kills the transfer mid-flight with SIGTERM/ENOBUFS. Transfers therefore inherit
 * stdio and pass --only-show-errors (--no-progress only drops the progress bar, not the per-file
 * lines). The commands whose output we need (the manifest, the bucket listing) get a maxBuffer
 * far above the size either can reach.
 */
function aws(
    args: string[],
    options: { allowFailure?: boolean; capture?: boolean } = {},
): string | null {
    try {
        if (options.capture) {
            return execFileSync('aws', args, {
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: 256 * 1024 * 1024,
            });
        }
        execFileSync('aws', args, { stdio: ['ignore', 'inherit', 'inherit'] });
        return '';
    } catch (error) {
        if (options.allowFailure) return null;
        throw error;
    }
}

/** Every file under dir, as POSIX-separated paths relative to it. */
function listFiles(dir: string, base = dir): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listFiles(full, base));
        else out.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return out;
}

function buildManifest(distDir: string, files: string[]): BuildManifest {
    const manifest: BuildManifest = {};
    for (const file of files) manifest[file] = contentHash(fs.readFileSync(path.join(distDir, file)));
    return manifest;
}

function readPreviousDeploy(bucket: string, prefix: string): PreviousDeploy {
    const raw = aws(['s3', 'cp', `s3://${bucket}/${objectKey(prefix, MANIFEST_KEY)}`, '-'], { allowFailure: true, capture: true });
    if (raw !== null) {
        try {
            const manifest = parseManifest(JSON.parse(raw));
            if (manifest) return { source: 'manifest', manifest };
        } catch {
            // Unreadable JSON: fall through to the listing, like a missing manifest.
        }
        console.warn('[deploy] previous manifest is unreadable.');
    }

    // No manifest (the first deploy of this site, or a lost one): what is in the bucket is still
    // knowable from its listing, so only files that really differ get uploaded.
    console.log('[deploy] no previous manifest, comparing against the bucket listing instead.');
    const listing = aws([
        's3api', 'list-objects-v2', '--bucket', bucket,
        ...(prefix ? ['--prefix', `${prefix}/`] : []),
        '--query', 'Contents[].[Key,ETag]', '--output', 'json',
    ], { allowFailure: true, capture: true });
    if (listing === null) {
        console.log('[deploy] bucket listing failed, uploading everything.');
        return { source: 'none' };
    }
    return { source: 'listing', manifest: manifestFromListing(JSON.parse(listing), prefix) };
}

/** Hardlinks (falling back to a copy) the given files into a clean staging tree. */
function stageFiles(distDir: string, stageDir: string, files: string[]): void {
    fs.rmSync(stageDir, { recursive: true, force: true });
    for (const file of files) {
        const target = path.join(stageDir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const source = path.join(distDir, file);
        try {
            fs.linkSync(source, target);
        } catch {
            // Hardlinks fail across filesystems; a copy is correct either way, just slower.
            fs.copyFileSync(source, target);
        }
    }
}

function main(): void {
    const { site, bucket, dryRun } = parseArgs();
    const { dist, prefix } = SITES[site];
    const distDir = path.join(REPO_ROOT, dist);
    const stageDir = path.join(WORK_DIR, site);
    // `cp --recursive`, not `sync`: the staged set is already exactly what must go up, and sync
    // would compare it against the bucket again by size and mtime.
    const destination = `s3://${bucket}/${prefix ? `${prefix}/` : ''}`;

    if (!fs.existsSync(distDir)) {
        throw new Error(`[deploy] ${distDir} not found: run the build first.`);
    }

    const files = listFiles(distDir);
    console.log(`[deploy] ${site}: hashing ${files.length} built file(s)...`);
    const next = buildManifest(distDir, files);
    const previous = readPreviousDeploy(bucket, prefix);

    const { changed, removed, unchanged } = diffManifests(previous, next);
    console.log(`[deploy] ${changed.length} changed, ${removed.length} removed, ${unchanged} unchanged.`);
    const batches = planUploads(site, changed);

    if (dryRun) {
        for (const { cacheControl, files: batch } of batches) {
            console.log(`[deploy]   would upload ${batch.length} file(s) with "${cacheControl}"`);
        }
        console.log(`[deploy]   would delete ${removed.length} object(s)`);
        console.log('[deploy] dry run, nothing was uploaded.');
        return;
    }

    if (changed.length === 0 && removed.length === 0 && previous.source === 'manifest') {
        console.log('[deploy] nothing to do; leaving the existing manifest in place.');
        return;
    }

    for (const { cacheControl, files: batch } of batches) {
        stageFiles(distDir, stageDir, batch);
        console.log(`[deploy] uploading ${batch.length} file(s) with "${cacheControl}"...`);
        aws(['s3', 'cp', stageDir, destination, '--recursive', '--cache-control', cacheControl, '--only-show-errors']);
    }

    for (let i = 0; i < removed.length; i += DELETE_BATCH_SIZE) {
        const payload = JSON.stringify({
            Objects: removed.slice(i, i + DELETE_BATCH_SIZE).map(file => ({ Key: objectKey(prefix, file) })),
            Quiet: true,
        });
        aws(['s3api', 'delete-objects', '--bucket', bucket, '--delete', payload]);
    }
    if (removed.length > 0) console.log(`[deploy] deleted ${removed.length} stale object(s).`);

    // Written last, and only after every upload and delete has succeeded: if anything above
    // throws, the old manifest survives and the next deploy retries the same work.
    const manifestPath = path.join(WORK_DIR, `${site}${MANIFEST_KEY}`);
    fs.writeFileSync(manifestPath, JSON.stringify(next));
    aws([
        's3', 'cp', manifestPath, `s3://${bucket}/${objectKey(prefix, MANIFEST_KEY)}`,
        '--cache-control', 'no-store',
        '--only-show-errors',
    ]);

    fs.rmSync(stageDir, { recursive: true, force: true });
    console.log(`[deploy] done: ${changed.length} uploaded, ${removed.length} deleted.`);
}

main();
