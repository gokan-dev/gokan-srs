#!/usr/bin/env bun
// `bun run check:parity`: which dictionary pages a change touches. Builds the dictionary at the
// base (the merge-base of a ref with HEAD, so what landed on the base branch since does not show
// as this change's) and at HEAD, and compares every file of the two dist/ directories
// (src/lib/parity.ts). Issue #199's steps run it with `--expect identical`; elsewhere it reports.
//
// Usage: bun run check:parity [--base <ref>] [--no-build] [--expect identical]
//   --base       default origin/main; CI passes HEAD^1, a pull request's base tip (see
//                .github/workflows/ci-gokan-dictionary.yml)
//   --no-build   compare HEAD's existing dist/ (CI builds it in the step before)
//   --expect identical   exit 1 on any difference
//
// The base is built in a worktree cached under node_modules/.cache/check-parity and moved on
// later runs, with its own install and its own dataset: a worktree of the dataset submodule at
// the base's pointer, so a change that moves the pointer is compared against the data it moved
// from. Thin glue over src/lib/parity.ts; verified by running it.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compareOutputs, exampleCandidates, firstDifference, isIdentical, parityReport, type Example } from '../src/lib/parity';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const APP = path.relative(REPO_ROOT, APP_DIR);
const DATASET = path.join('apps', 'gokan-srs', 'dataset');
const WORKTREE = path.join(REPO_ROOT, 'node_modules', '.cache', 'check-parity');
/** What the dictionary's build reads from the dataset: its code (the English view) and compiled/. */
const DATASET_SPARSE = ['/.gitattributes', '/src/', '/compiled/'];
const EXAMPLES = 5;

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
};
const BASE_REF = option('--base') ?? 'origin/main';
const BUILD_HEAD = !args.includes('--no-build');
const expectation = option('--expect');
if (expectation !== undefined && expectation !== 'identical') throw new Error(`[check-parity] --expect takes "identical", not "${expectation}".`);

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

/** Every file under `dir`, as a forward-slash path to the sha-256 of its bytes. */
function hashes(dir: string): Map<string, string> {
    const result = new Map<string, string>();
    const walk = (relative: string): void => {
        for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
            const rel = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(rel);
            else result.set(rel, createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex'));
        }
    };
    walk('');
    return result;
}

function main(): void {
    const tip = git(['rev-parse', '--verify', `${BASE_REF}^{commit}`]);
    const base = git(['merge-base', tip, 'HEAD']);
    const against = `${BASE_REF} (merge-base ${base.slice(0, 10)})`;

    const baseDist = buildBase(base);
    const headDist = path.join(APP_DIR, 'dist');
    if (BUILD_HEAD) run('bun', ['run', 'build'], APP_DIR);
    if (!fs.existsSync(headDist)) throw new Error(`[check-parity] ${headDist} does not exist: build the dictionary, or drop --no-build.`);

    const result = compareOutputs(hashes(baseDist), hashes(headDist));
    const examples: Example[] = exampleCandidates(result.changed, EXAMPLES).map(file => ({
        path: file,
        difference: firstDifference(fs.readFileSync(path.join(baseDist, file), 'utf8'), fs.readFileSync(path.join(headDist, file), 'utf8')),
    }));
    const report = parityReport(result, against, examples);
    console.log(report);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) fs.appendFileSync(summary, `## Dictionary pages\n\n${report}\n`);

    if (expectation === 'identical' && !isIdentical(result)) {
        console.error('[check-parity] --expect identical: the pages differ.');
        process.exit(1);
    }
}

main();
