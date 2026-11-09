#!/usr/bin/env bun
// `bun run check:parity`: which dictionary pages a change touches. Builds the dictionary at the
// base (the merge-base of a ref with HEAD, so what landed on the base branch since does not show
// as this change's) and at HEAD, and compares every file of the two dist/ directories
// (src/lib/parity.ts). Issue #199's steps run it with `--expect identical`; elsewhere it reports.
//
// Usage: bun run check:parity [--base <ref> | --against-server] [--no-build] [--expect identical]
//   --base       default origin/main; CI passes HEAD^1, a pull request's base tip (see
//                .github/workflows/ci-gokan-dictionary.yml)
//   --no-build   compare HEAD's existing dist/ (CI builds it in the step before)
//   --expect identical   exit 1 on any difference, a renamed asset reference included
//   --against-server     compare HEAD's static build (every page prerendered) with what HEAD's
//                server serves (an on-request build: the list pages static, the entity pages
//                rendered from the published dataset over HTTP), every file of the static build
//                requested from a local stand-in for CloudFront (scripts/lib/builtSite.ts), under
//                /dictionary/ as in production. With --no-build, dist/ is the static build.
// A missing value, or a flag where a value goes, exits 2 with the usage.
//
// The base is built in a worktree cached in the repository's git directory (check-parity) and
// moved on later runs, with its own install and its own dataset: a worktree of the dataset submodule at
// the base's pointer, so a change that moves the pointer is compared against the data it moved
// from. Never under node_modules/: Node refuses to strip types from a file there, so the base's
// vite.config.ts could not load a workspace package's TypeScript (@gokan/deploy/dataset-version).
// Thin glue over src/lib/parity.ts; verified by running it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashBuild, listFiles } from '@gokan/deploy/build-files';
import { contentHash, pageContentHash } from '@gokan/deploy/deploy-manifest';
import { DICTIONARY_BASE_PATH } from '@gokan/dataset-schema';

import { serveDictionaryOnRequest } from '../../../scripts/lib/builtSite';

import {
    compareOutputs,
    exampleCandidates,
    firstDifference,
    isIdentical,
    isTextOutput,
    parityReport,
    parseParityArgs,
    servedPath,
    type Example,
    type Output,
} from '../src/lib/parity';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const APP = path.relative(REPO_ROOT, APP_DIR);
const DATASET = path.join('apps', 'gokan-srs', 'dataset');
const WORKTREE = path.join(
    path.resolve(REPO_ROOT, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()),
    'check-parity',
);
/** What the dictionary's build reads from the dataset: its code (the English view) and compiled/. */
const DATASET_SPARSE = ['/.gitattributes', '/src/', '/compiled/'];
const EXAMPLES = 5;

const options = parseParityArgs(process.argv.slice(2));
if (options instanceof Error) {
    console.error(`[check-parity] ${options.message}`);
    process.exit(2);
}
const { base: BASE_REF, build: BUILD_HEAD, expectIdentical, againstServer, againstOrigin } = options;

const git = (gitArgs: string[], cwd = REPO_ROOT): string =>
    execFileSync('git', gitArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const run = (command: string, commandArgs: string[], cwd: string): void => {
    execFileSync(command, commandArgs, { cwd, stdio: 'inherit' });
};

/** `commit` fetched into the repository at `cwd` if a shallow clone (CI's) does not have it. */
function ensureCommit(commit: string, cwd: string): void {
    try {
        git(['cat-file', '-e', `${commit}^{commit}`], cwd);
    } catch {
        git(['fetch', '--quiet', '--depth=1', 'origin', commit], cwd);
    }
}

/**
 * Git with an explicit work tree. A worktree of the dataset submodule inherits the submodule's
 * shared `core.worktree`, and without this git would write its files next to the submodule's git
 * directory; refusing when the top level is not `workTree` keeps a mistake from touching another
 * checkout.
 */
function checkOutAt(workTree: string, commit: string, sparse?: readonly string[]): void {
    const inTree = (gitArgs: string[]): string =>
        git(['--work-tree', workTree, ...(sparse ? ['-c', 'core.sparseCheckout=true', '-c', 'core.sparseCheckoutCone=false'] : []), ...gitArgs], workTree);
    if (sparse) {
        const gitDir = path.resolve(workTree, git(['rev-parse', '--git-dir'], workTree));
        fs.mkdirSync(path.join(gitDir, 'info'), { recursive: true });
        fs.writeFileSync(path.join(gitDir, 'info', 'sparse-checkout'), `${sparse.join('\n')}\n`);
    }
    const top = path.resolve(inTree(['rev-parse', '--show-toplevel']));
    if (top.toLowerCase() !== path.resolve(workTree).toLowerCase()) throw new Error(`[check-parity] ${workTree} resolves to ${top}; refusing to check out.`);
    inTree(['reset', '--quiet', '--hard', commit]);
}

/** A linked worktree of the repository at `repo`, at `commit`, created on first use. */
function worktree(repo: string, workTree: string, commit: string, sparse?: readonly string[]): void {
    git(['worktree', 'prune'], repo);
    if (!fs.existsSync(path.join(workTree, '.git'))) {
        fs.rmSync(workTree, { recursive: true, force: true });
        git(['worktree', 'add', '--quiet', '--no-checkout', '--detach', workTree, commit], repo);
    }
    checkOutAt(workTree, commit, sparse);
}

/** The base's dist/, built unless the cached build is already of this commit and dataset. */
function buildBase(commit: string): string {
    worktree(REPO_ROOT, WORKTREE, commit);
    const datasetCommit = git(['rev-parse', `${commit}:${DATASET.replaceAll('\\', '/')}`]);
    const datasetRepo = path.join(REPO_ROOT, DATASET);
    ensureCommit(datasetCommit, datasetRepo);
    worktree(datasetRepo, path.join(WORKTREE, DATASET), datasetCommit, DATASET_SPARSE);

    const marker = path.join(WORKTREE, 'node_modules', '.cache', 'check-parity-build');
    const stamp = `${commit} ${datasetCommit}`;
    const dist = path.join(WORKTREE, APP, 'dist');
    if (fs.existsSync(dist) && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === stamp) {
        console.log(`[check-parity] base build of ${commit.slice(0, 10)} is cached.`);
        return dist;
    }
    run('bun', ['install', '--frozen-lockfile'], WORKTREE);
    run('bun', ['run', 'build'], path.join(WORKTREE, APP));
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, stamp);
    return dist;
}

/** Every file under `dir`, listed and hashed by the deploy's own `hashBuild`: bytes and content. */
function output(dir: string): Output {
    const { hashes, content } = hashBuild(dir);
    return { bytes: new Map(Object.entries(hashes)), content: new Map(Object.entries(content)) };
}

/** A changed file shown as its first difference, or by size when it is not text. */
function example(baseDist: string, headDist: string, file: string): Example {
    const before = fs.readFileSync(path.join(baseDist, file));
    const after = fs.readFileSync(path.join(headDist, file));
    if (!isTextOutput(file)) return { path: file, change: { kind: 'binary', beforeBytes: before.length, afterBytes: after.length } };
    return { path: file, change: { kind: 'text', difference: firstDifference(before.toString('utf8'), after.toString('utf8')) } };
}

function main(): void {
    const tip = git(['rev-parse', '--verify', `${BASE_REF}^{commit}`]);
    const base = git(['merge-base', tip, 'HEAD']);
    const against = `${BASE_REF} (merge-base ${base.slice(0, 10)})`;

    const baseDist = buildBase(base);
    const headDist = path.join(APP_DIR, 'dist');
    if (BUILD_HEAD) run('bun', ['run', 'build'], APP_DIR);
    if (!fs.existsSync(headDist)) throw new Error(`[check-parity] ${headDist} does not exist: build the dictionary, or drop --no-build.`);

    const result = compareOutputs(output(baseDist), output(headDist));
    const examples = exampleCandidates(result, EXAMPLES).map(file => example(baseDist, headDist, file));
    const report = parityReport(result, against, examples);
    console.log(report);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) fs.appendFileSync(summary, `## Dictionary pages\n\n${report}\n`);

    if (expectIdentical && !isIdentical(result)) {
        console.error('[check-parity] --expect identical: the pages differ.');
        process.exit(1);
    }
}

/** The static build, kept while the on-request build takes dist/. */
const REFERENCE = path.join(REPO_ROOT, 'node_modules', '.cache', 'check-parity-server', 'dist');
/**
 * About 10,000 page requests per 5 minutes from one address: past production's page rate rule
 * (dictionary-page-rate, limit 1,000, apps/gokan-srs/terraform/main.tf), so a production run has
 * the rule's action at "count". Read a change to either number against the other.
 */
const PARALLEL_REQUESTS = 8;

/**
 * The sitemap as built, from the sitemap as deployed: the deploy dates each URL (<lastmod>,
 * datedSitemap in @gokan/deploy), which the build leaves out to stay byte-reproducible.
 */
const undated = (body: Buffer): Buffer => Buffer.from(body.toString('utf8').replaceAll(/<lastmod>[^<]*<\/lastmod>/g, ''));

/**
 * A request that may meet a passing failure over 40k of them against a deployed site: a dropped
 * connection, or a throttled or unavailable server (429, 503: the function at its concurrency
 * limit). Retried with a growing wait; any other answer, a 404 included, is the answer.
 */
async function fetchPatiently(url: string): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url);
            if ((response.status !== 429 && response.status !== 503) || attempt === 5) return response;
        } catch (error) {
            if (attempt === 5) throw error;
        }
        await new Promise(done => setTimeout(done, 500 * 2 ** attempt));
    }
}

/** Every file of the reference, as `origin` serves it: bytes by path, anything but a 200 left out. */
async function served(origin: string, files: readonly string[]): Promise<{ output: Output; bodies: Map<string, Buffer>; statuses: Map<string, number> }> {
    const bytes = new Map<string, string>();
    const content = new Map<string, string>();
    const bodies = new Map<string, Buffer>();
    const statuses = new Map<string, number>();
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < files.length) {
            const file = files[next++];
            const response = await fetchPatiently(`${origin}${servedPath(DICTIONARY_BASE_PATH, file)}`);
            const raw = Buffer.from(await response.arrayBuffer());
            const body = file === 'sitemap.xml' ? undated(raw) : raw;
            statuses.set(file, response.status);
            if (response.status !== 200) continue;
            bodies.set(file, body);
            bytes.set(file, contentHash(body));
            content.set(file, pageContentHash(file, body));
        }
    };
    await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, worker));
    return { output: { bytes, content }, bodies, statuses };
}

/** What only the server can get wrong: a missing page's status, document and cache-control, and a page's. */
async function serverProblems(origin: string, entityPage: string): Promise<string[]> {
    const problems: string[] = [];
    const missing = await fetch(`${origin}${DICTIONARY_BASE_PATH}/vocab/0000000/`);
    const missingBody = await missing.text();
    if (missing.status !== 404) problems.push(`an unknown word answers ${missing.status}, not 404`);
    if (!missingBody.includes('<meta name="robots" content="noindex" />')) problems.push('the 404 page is not noindex');
    if (!/s-maxage=300/.test(missing.headers.get('cache-control') ?? '')) problems.push(`the 404 page's cache-control is "${missing.headers.get('cache-control')}"`);
    const page = await fetch(`${origin}${servedPath(DICTIONARY_BASE_PATH, entityPage)}`);
    if (!/must-revalidate, s-maxage=31536000/.test(page.headers.get('cache-control') ?? '')) problems.push(`${entityPage}'s cache-control is "${page.headers.get('cache-control')}"`);
    return problems;
}

/**
 * Every file of the static build at `reference` against what `origin` serves, plus what only a
 * server can get wrong (serverProblems). `label` names what is compared in the report.
 */
async function compareServed(origin: string, reference: string, label: string): Promise<void> {
    // The asset build's manifest is a build file, never requested by a reader.
    const files = listFiles(reference).filter(file => !file.startsWith('.vite/'));
    const { output: server, bodies, statuses } = await served(origin, files);
    const built = output(reference);
    const kept = (map: ReadonlyMap<string, string>) => new Map([...map].filter(([file]) => !file.startsWith('.vite/')));
    const result = compareOutputs({ bytes: kept(built.bytes), content: kept(built.content) }, server);
    const examples = exampleCandidates(result, EXAMPLES).map((file): Example => {
        const before = fs.readFileSync(path.join(reference, file));
        const after = bodies.get(file);
        if (after === undefined) return { path: file, change: { kind: 'binary', beforeBytes: before.length, afterBytes: 0 } };
        return { path: file, change: { kind: 'text', difference: firstDifference(before.toString('utf8'), after.toString('utf8')) } };
    });
    const report = parityReport(result, label, examples);
    const notServed = [...statuses].filter(([, status]) => status !== 200);
    console.log(report);
    for (const [file, status] of notServed.slice(0, EXAMPLES)) console.log(`- ${file}: ${status}`);
    const problems = await serverProblems(origin, files.find(file => /^vocab\/\d+\/index\.html$/.test(file)) ?? 'vocab/');
    for (const problem of problems) console.error(`[check-parity] ${problem}`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) fs.appendFileSync(summary, `## Dictionary pages served on request\n\n${report}\n`);

    if (problems.length > 0 || (expectIdentical && !isIdentical(result))) {
        console.error(`[check-parity] what ${origin} serves differs from the static build.`);
        process.exitCode = 1;
    }
}

/** The static build against the same commit built on request, behind a local stand-in for CloudFront. */
async function mainAgainstServer(): Promise<void> {
    if (BUILD_HEAD) run('bun', ['run', 'build'], APP_DIR);
    const dist = path.join(APP_DIR, 'dist');
    if (!fs.existsSync(path.join(dist, 'vocab'))) throw new Error(`[check-parity] ${dist} holds no static build: build the dictionary, or drop --no-build.`);
    fs.rmSync(REFERENCE, { recursive: true, force: true });
    fs.cpSync(dist, REFERENCE, { recursive: true });
    run('bun', ['run', 'build:on-request'], APP_DIR);

    const site = await serveDictionaryOnRequest();
    try {
        await compareServed(`http://127.0.0.1:${site.port}`, REFERENCE, 'the static build (served on request)');
    } finally {
        site.stop();
    }
}

/**
 * The static build against a deployed site (#209: staging, then production), every sitemap and
 * entity URL included. Build it as that site was built (VITE_SITE_ORIGIN, and production's
 * VITE_UMAMI_WEBSITE_ID), or every page differs by its canonical or its analytics tag.
 */
async function mainAgainstOrigin(origin: string): Promise<void> {
    if (BUILD_HEAD) run('bun', ['run', 'build'], APP_DIR);
    const dist = path.join(APP_DIR, 'dist');
    if (!fs.existsSync(path.join(dist, 'vocab'))) throw new Error(`[check-parity] ${dist} holds no static build: build the dictionary, or drop --no-build.`);
    await compareServed(origin, dist, `the static build (served by ${origin})`);
}

if (againstOrigin !== undefined) await mainAgainstOrigin(againstOrigin);
else if (againstServer) await mainAgainstServer();
else main();
