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
//   --expect identical   exit 1 on any difference, a renamed asset reference included
// A missing value, or a flag where a value goes, exits 2 with the usage.
//
// The base is built in a worktree cached under node_modules/.cache/check-parity and moved on
// later runs, with its own install and its own dataset: a worktree of the dataset submodule at
// the base's pointer, so a change that moves the pointer is compared against the data it moved
// from. Thin glue over src/lib/parity.ts; verified by running it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashBuild } from '@gokan/deploy/build-files';

import {
    compareOutputs,
    exampleCandidates,
    firstDifference,
    isIdentical,
    isTextOutput,
    parityReport,
    parseParityArgs,
    type Example,
    type Output,
} from '../src/lib/parity';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const APP = path.relative(REPO_ROOT, APP_DIR);
const DATASET = path.join('apps', 'gokan-srs', 'dataset');
const WORKTREE = path.join(REPO_ROOT, 'node_modules', '.cache', 'check-parity');
/** What the dictionary's build reads from the dataset: its code (the English view) and compiled/. */
const DATASET_SPARSE = ['/.gitattributes', '/src/', '/compiled/'];
const EXAMPLES = 5;

const options = parseParityArgs(process.argv.slice(2));
if (options instanceof Error) {
    console.error(`[check-parity] ${options.message}`);
    process.exit(2);
}
const { base: BASE_REF, build: BUILD_HEAD, expectIdentical } = options;

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

main();
