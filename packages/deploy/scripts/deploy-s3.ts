#!/usr/bin/env bun
// Content-addressed deploy of one site's dist/ to its S3 prefix (gokan-srs at the bucket root,
// gokan-dictionary under dictionary/, the published dataset under dataset/). See
// src/deployManifest.ts for why neither the default `aws s3 sync` nor `--size-only` is correct
// here.
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
// Usage: bun packages/deploy/scripts/deploy-s3.ts --site srs|dictionary|data --bucket <name>
//          [--pages-on-server [--keep-removed | --prune-pages]] [--dry-run]
//   --pages-on-server  the dictionary's pages are its server's (#209): dated, never uploaded
//   --keep-removed     keep what the previous deploy owned and this build lacks (a rollback copy)
//   --prune-pages      delete the pages the previous deploy uploaded: only once CloudFront routes
//                      every page to the server. With neither, a bucket still holding pages
//                      refuses the deploy (deployRefusal), so pruning is never implied.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    SITEMAP_FILE,
    SITES,
    changeDates,
    contentHash,
    datedSitemap,
    deployRefusal,
    deployedManifest,
    diffManifests,
    isSite,
    manifestFromListing,
    objectKey,
    pageContentHash,
    parseManifest,
    planUploads,
    sameFiles,
    serializeManifest,
    servedFiles,
    serverPages,
    type DeployedOptions,
    type PreviousDeploy,
    type Site,
} from '../src/deployManifest';
import { hashBuild } from '../src/buildFiles';
import { invalidationFor, type Invalidation } from '../src/invalidation';

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
    /** What the bucket keeps of the build and of the previous deploy (deployedManifest). */
    deployed: DeployedOptions;
    /** A file the CloudFront paths to clear are appended to, one a line (invalidationFor). */
    invalidations: string | undefined;
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
        throw new Error(`usage: deploy-s3.ts --site ${Object.keys(SITES).join('|')} --bucket <name> [--pages-on-server [--keep-removed | --prune-pages]] [--invalidations <file>] [--dry-run]`);
    }
    const pagesOnServer = argv.includes('--pages-on-server');
    // Only the dictionary has a server; another site's pages would simply never be uploaded.
    if (pagesOnServer && site !== 'dictionary') throw new Error('[deploy] --pages-on-server is for the dictionary only.');
    return {
        site,
        bucket,
        dryRun: argv.includes('--dry-run'),
        deployed: { pagesOnServer, keepRemoved: argv.includes('--keep-removed'), prunePages: argv.includes('--prune-pages') },
        invalidations: get('--invalidations'),
    };
}

/** Appends the paths to clear to the workflow's list, and says what they are. */
function recordInvalidation(site: Site, file: string | undefined, { paths, changedFiles }: Invalidation): void {
    if (paths.length === 0) console.log(`[deploy] ${site}: nothing a visitor can get changed, nothing to invalidate.`);
    else console.log(`[deploy] ${site}: invalidate ${paths.join(' ')} (${changedFiles} file(s) changed).`);
    if (file !== undefined && paths.length > 0) fs.appendFileSync(file, paths.map(p => `${p}\n`).join(''));
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

function readPreviousDeploy(bucket: string, prefix: string): PreviousDeploy {
    const raw = aws(['s3', 'cp', `s3://${bucket}/${objectKey(prefix, MANIFEST_KEY)}`, '-'], { allowFailure: true, capture: true });
    if (raw !== null) {
        try {
            const stored = parseManifest(JSON.parse(raw));
            if (stored) return { source: 'manifest', manifest: stored.hashes, content: stored.content, changed: stored.changed, server: stored.server };
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
    const { site, bucket, dryRun, deployed: deployedOptions, invalidations } = parseArgs();
    const { dist, prefix, include } = SITES[site];
    const distDir = path.join(REPO_ROOT, dist);
    const stageDir = path.join(WORK_DIR, site);
    // `cp --recursive`, not `sync`: the staged set is already exactly what must go up, and sync
    // would compare it against the bucket again by size and mtime.
    const destination = `s3://${bucket}/${prefix ? `${prefix}/` : ''}`;

    if (!fs.existsSync(distDir)) {
        throw new Error(`[deploy] ${distDir} not found: run the build first.`);
    }

    const { files, hashes: built, content } = hashBuild(distDir, include);
    console.log(`[deploy] ${site}: hashed ${files.length} built file(s).`);
    const previous = readPreviousDeploy(bucket, prefix);
    // The UTC day, as the sitemap's W3C date format expects.
    const today = new Date().toISOString().slice(0, 10);

    // The built sitemap carries no dates (the build stays byte-reproducible): each URL gets the
    // day its page last changed here, after the diff that knows it and before the upload. Written
    // over the built file, so it is hashed, diffed and uploaded like any other: with no content
    // change it has the same bytes as the deployed one and stays where it is.
    // A dry run dates it in memory only: it touches nothing, so the real run after it (the deploy's
    // pre-flight, deploy-site.yml) still finds the undated build.
    const sitemapPath = path.join(distDir, SITEMAP_FILE);
    if (fs.existsSync(sitemapPath)) {
        const sitemap = datedSitemap(site, fs.readFileSync(sitemapPath, 'utf-8'), changeDates(previous, content, today));
        const bytes = Buffer.from(sitemap, 'utf-8');
        if (!dryRun) fs.writeFileSync(sitemapPath, bytes);
        built[SITEMAP_FILE] = contentHash(bytes);
        content[SITEMAP_FILE] = pageContentHash(SITEMAP_FILE, bytes);
    }
    const dates = changeDates(previous, content, today);

    // Before anything is uploaded or deleted, dry run included: it shows the same refusal.
    const refusal = deployRefusal(previous, deployedOptions);
    if (refusal !== null) throw new Error(`[deploy] ${site}: ${refusal}`);

    // Every page is dated above; what the bucket holds may be less (pages on the server) or more
    // (a rollback copy kept), and is what the manifest records as deployed.
    const next = deployedManifest(previous, built, deployedOptions);
    if (deployedOptions.pagesOnServer) console.log('[deploy] pages are served by the server: dated, not uploaded.');
    if (deployedOptions.keepRemoved) console.log('[deploy] keeping what the previous deploy owned and this build lacks.');
    if (deployedOptions.prunePages) console.log('[deploy] pruning the pages the previous deploy uploaded.');
    const { changed, removed, unchanged } = diffManifests(previous, next);
    console.log(`[deploy] ${changed.length} changed, ${removed.length} removed, ${unchanged} unchanged.`);
    const batches = planUploads(site, changed);

    // What a visitor could get before this deploy and can get after it, the bucket's files and the
    // server's pages: what changed between the two is what CloudFront must stop serving. Only a
    // stored manifest says what was served; a bucket listing of the root also holds the other
    // sites' keys, so without one the previous deploy counts as unknown.
    const server = serverPages(built, deployedOptions);
    const invalidation = invalidationFor(
        site,
        previous.source === 'manifest' ? servedFiles(previous.manifest, previous.server) : null,
        servedFiles(next, server),
    );

    if (dryRun) {
        for (const { cacheControl, files: batch } of batches) {
            console.log(`[deploy]   would upload ${batch.length} file(s) with "${cacheControl}"`);
        }
        console.log(`[deploy]   would delete ${removed.length} object(s)`);
        console.log(`[deploy]   would invalidate ${invalidation.paths.length === 0 ? 'nothing' : invalidation.paths.join(' ')}`);
        console.log('[deploy] dry run, nothing was uploaded.');
        return;
    }

    // A page the server renders can change with nothing to upload: the manifest still records it,
    // or the next deploy would clear it again.
    if (changed.length === 0 && removed.length === 0 && previous.source === 'manifest' && sameFiles(previous.server, server)) {
        console.log('[deploy] nothing to do; leaving the existing manifest in place.');
        recordInvalidation(site, invalidations, invalidation);
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
    // Created here too: a deploy that only records server pages uploads nothing, so no staging
    // tree made the directory.
    fs.mkdirSync(WORK_DIR, { recursive: true });
    fs.writeFileSync(manifestPath, serializeManifest({ hashes: next, content, changed: dates, server }));
    aws([
        's3', 'cp', manifestPath, `s3://${bucket}/${objectKey(prefix, MANIFEST_KEY)}`,
        '--cache-control', 'no-store',
        '--only-show-errors',
    ]);

    fs.rmSync(stageDir, { recursive: true, force: true });
    console.log(`[deploy] done: ${changed.length} uploaded, ${removed.length} deleted.`);
    recordInvalidation(site, invalidations, invalidation);
}

main();
