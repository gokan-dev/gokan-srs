/**
 * Waits for CI on a pushed commit and reports it: `bun run ci:wait [--sha <sha>] [--timeout <minutes>]`.
 * CI is the one place the full gate runs (AGENTS.md, Workflow), for people and agents alike: push the
 * branch, then run this instead of `bun run check` and the builds locally. It prints one line per "CI: ..."
 * workflow, the tail of every failed job's log, and exits 0 only when every run passed (1 on a failure,
 * 2 when no CI run appears, the wait times out or GitHub stays unreachable). Needs `gh`, signed in.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { gh } from './lib/actions';
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

// GitHub matches the full sha only, so a short one is resolved here.
const sha = execFileSync('git', ['rev-parse', '--verify', `${values.sha ?? 'HEAD'}^{commit}`], { encoding: 'utf8' }).trim();
const deadline = Date.now() + Number(values.timeout) * 60_000;
const started = Date.now();

// A network hiccup is not CI's answer: keep the last runs seen and ask again, up to this many times in a row.
const MAX_FETCH_FAILURES = 5;
let fetchFailures = 0;
let lastRuns: CiRun[] = [];

function fetchRuns(): CiRun[] {
    try {
        const json: unknown = JSON.parse(gh(['run', 'list', '--commit', sha, '--limit', '100', '--json', RUN_FIELDS]));
        lastRuns = latestCiRuns(parseRuns(json), sha);
        fetchFailures = 0;
    } catch (error) {
        fetchFailures += 1;
        console.error(`Could not read CI's runs (${fetchFailures} of ${MAX_FETCH_FAILURES}): ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        if (fetchFailures >= MAX_FETCH_FAILURES) process.exit(2);
    }
    return lastRuns;
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
