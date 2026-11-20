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
import { type CiRun, RUN_FIELDS, failedJobLogs, failedRuns, latestCiRuns, parseRuns, parseTimeoutMinutes, runLine, settled, verdict } from './lib/ciRuns';

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
const firstLine = (error: unknown): string => (error instanceof Error ? error.message.split('\n')[0] ?? '' : String(error));

const timeoutMinutes = parseTimeoutMinutes(values.timeout);
if (timeoutMinutes === undefined) {
    console.error(`Usage: bun run ci:wait [--sha <sha>] [--timeout <minutes>]: --timeout must be a number of minutes above 0, not "${values.timeout}".`);
    process.exit(2);
}

// GitHub matches the full sha only, so a short one is resolved here. A typo is not a CI failure: exit 2.
const wanted = values.sha ?? 'HEAD';
let sha: string;
try {
    sha = execFileSync('git', ['rev-parse', '--verify', '--quiet', `${wanted}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
    console.error(`Unknown commit: ${wanted}`);
    process.exit(2);
}
const deadline = Date.now() + timeoutMinutes * 60_000;
const started = Date.now();

// A network hiccup is not CI's answer: the caller keeps the runs it has and asks again, up to this many times in a row.
const MAX_FETCH_FAILURES = 5;
let fetchFailures = 0;
/** The commit's runs, or undefined when GitHub could not be read this time. */
function fetchRuns(): CiRun[] | undefined {
    try {
        const json: unknown = JSON.parse(gh(['run', 'list', '--commit', sha, '--limit', '100', '--json', RUN_FIELDS]));
        fetchFailures = 0;
        return latestCiRuns(parseRuns(json), sha);
    } catch (error) {
        fetchFailures += 1;
        console.error(`Could not read CI's runs (${fetchFailures} of ${MAX_FETCH_FAILURES}): ${firstLine(error)}`);
        if (fetchFailures >= MAX_FETCH_FAILURES) process.exit(2);
        return undefined;
    }
}

function report(runs: CiRun[]): void {
    for (const run of runs) console.log(`  ${runLine(run)}  ${run.url}`);
}

console.log(`Waiting for CI on ${sha.slice(0, 10)}...`);
let runs = fetchRuns() ?? [];
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
        if (settled(runs, again)) break;
        runs = again ?? runs;
        continue;
    }
    if (runs.length === 0 && Date.now() - started > APPEAR_MS) {
        console.error(`No CI run for ${sha} after ${APPEAR_MS / 60_000} minutes: is the commit pushed?`);
        process.exit(2);
    }
    if (Date.now() > deadline) {
        console.error(`CI still running after ${timeoutMinutes} minutes.`);
        process.exit(2);
    }
    await sleep(POLL_MS);
    runs = fetchRuns() ?? runs;
}

const failed = failedRuns(runs);
if (failed.length === 0) {
    console.log('CI passed.');
    process.exit(0);
}
for (const run of failed) {
    console.log(`\n--- ${run.workflow} (${run.event}, ${run.conclusion}): ${run.url}`);
    if (run.conclusion !== 'failure') continue;
    // CI did fail whatever happens here: a log that cannot be fetched is said, never a stack trace over the summary.
    let log: string;
    try {
        log = gh(['run', 'view', String(run.id), '--log-failed']);
    } catch {
        console.log(`Could not fetch the log: ${run.url}`);
        continue;
    }
    for (const job of failedJobLogs(log, LOG_LINES)) {
        if (job.job) console.log(`\n-- ${job.job}`);
        console.log(job.lines.join('\n'));
    }
}
process.exit(1);
