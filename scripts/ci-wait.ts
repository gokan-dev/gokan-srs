/**
 * Waits for CI on a pushed commit and reports it: `bun run ci:wait [--sha <sha>] [--timeout <minutes>]`.
 * CI is the one place the full gate runs (AGENTS.md, Workflow), for people and agents alike: push the
 * branch, then run this instead of `bun run check` and the builds locally. It prints one line per "CI: ..."
 * workflow, the tail of every failed job's log, and exits 0 only when every run passed (1 on a failure,
 * 2 when no CI run appears or the wait times out). Needs `gh`, signed in.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { type CiRun, RUN_FIELDS, cleanLogLine, failedRuns, latestCiRuns, parseRuns, runLine, verdict } from './lib/ciRuns';

const POLL_MS = 20_000;
// GitHub creates a push's runs within seconds; past this, the commit was not pushed or nothing matched.
const APPEAR_MS = 3 * 60_000;
const LOG_LINES = 60;

const { values } = parseArgs({
    options: {
        sha: { type: 'string' },
        timeout: { type: 'string', default: '60' },
    },
});

const gh = (args: string[]): string => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// GitHub matches the full sha only, so a short one is resolved here.
const sha = execFileSync('git', ['rev-parse', '--verify', `${values.sha ?? 'HEAD'}^{commit}`], { encoding: 'utf8' }).trim();
const deadline = Date.now() + Number(values.timeout) * 60_000;
const started = Date.now();

function fetchRuns(): CiRun[] {
    const json: unknown = JSON.parse(gh(['run', 'list', '--commit', sha, '--limit', '100', '--json', RUN_FIELDS]));
    return latestCiRuns(parseRuns(json), sha);
}

function report(runs: CiRun[]): void {
    for (const run of runs) console.log(`  ${runLine(run)}  ${run.url}`);
}

console.log(`Waiting for CI on ${sha.slice(0, 10)}...`);
let runs = fetchRuns();
let lastSeen = '';
for (;;) {
    const state = verdict(runs);
    const seen = runs.map(runLine).join('\n');
    if (seen !== lastSeen) {
        console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${state}`);
        report(runs);
        lastSeen = seen;
    }
    if (state !== 'pending') {
        // One more look: a workflow that starts a little late must not be missed.
        await sleep(POLL_MS);
        const again = fetchRuns();
        if (again.length === runs.length && verdict(again) === state) break;
        runs = again;
        continue;
    }
    if (runs.length === 0 && Date.now() - started > APPEAR_MS) {
        console.error(`No CI run for ${sha} after ${APPEAR_MS / 60_000} minutes: is the commit pushed?`);
        process.exit(2);
    }
    if (Date.now() > deadline) {
        console.error(`CI still running after ${values.timeout} minutes.`);
        process.exit(2);
    }
    await sleep(POLL_MS);
    runs = fetchRuns();
}

const failed = failedRuns(runs);
if (failed.length === 0) {
    console.log('CI passed.');
    process.exit(0);
}
for (const run of failed) {
    console.log(`\n--- ${run.workflow} (${run.conclusion}): ${run.url}`);
    if (run.conclusion !== 'failure') continue;
    const log = gh(['run', 'view', String(run.id), '--log-failed']).trimEnd().split('\n');
    console.log(log.slice(-LOG_LINES).map(cleanLogLine).join('\n'));
}
process.exit(1);
