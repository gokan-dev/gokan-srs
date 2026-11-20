// What CI said about one commit, read from `gh run list --json` (scripts/ci-wait.ts). Pure, so the
// waiting script is only I/O: which runs count, whether they are done, and what they concluded.

/** The `gh run list` fields ci-wait asks for. */
export const RUN_FIELDS = 'databaseId,workflowName,event,status,conclusion,headSha,url,createdAt';

export interface CiRun {
    id: number;
    workflow: string;
    event: string;
    /** queued, in_progress, completed... */
    status: string;
    /** Empty until the run completes. */
    conclusion: string;
    headSha: string;
    url: string;
    createdAt: string;
}

/** A commit's verification: its "CI: ..." workflows. Agent and deploy runs react to it, they do not check it. */
export const isVerification = (run: CiRun): boolean => run.workflow.startsWith('CI:');

const PASSING = new Set(['success', 'skipped', 'neutral']);

export type Verdict = 'pending' | 'passed' | 'failed';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** `gh run list --json` output, narrowed once; rows without an id or workflow are dropped. */
export function parseRuns(json: unknown): CiRun[] {
    if (!Array.isArray(json)) throw new Error('gh run list did not return a list');
    return json.filter(isRecord).flatMap(row => {
        const id = row.databaseId;
        const workflow = str(row.workflowName);
        if (typeof id !== 'number' || !workflow) return [];
        return [{
            id,
            workflow,
            event: str(row.event),
            status: str(row.status),
            conclusion: str(row.conclusion),
            headSha: str(row.headSha),
            url: str(row.url),
            createdAt: str(row.createdAt),
        }];
    });
}

/**
 * The latest run of each verification workflow and event on `sha`: a re-run or a later attempt replaces an
 * earlier one. Keyed by event too, because an open PR's commit has a `push` run and a `pull_request` run of
 * each workflow (the second tests the merge with the base), and one passing must not hide the other failing.
 */
export function latestCiRuns(runs: CiRun[], sha: string): CiRun[] {
    const latest = new Map<string, CiRun>();
    for (const run of runs) {
        if (run.headSha !== sha || !isVerification(run)) continue;
        const key = `${run.workflow}\0${run.event}`;
        const seen = latest.get(key);
        if (!seen || run.id > seen.id) latest.set(key, run);
    }
    return [...latest.values()].sort((a, b) => a.workflow.localeCompare(b.workflow) || a.event.localeCompare(b.event));
}

/** Pending while any run is unfinished or none has started; passed only when every run passed. */
export function verdict(runs: CiRun[]): Verdict {
    if (runs.length === 0 || runs.some(run => run.status !== 'completed')) return 'pending';
    return runs.every(run => PASSING.has(run.conclusion)) ? 'passed' : 'failed';
}

/**
 * Whether the one more look after a finished verdict confirms it: the same runs, the same verdict. A look that
 * failed (`undefined`) confirms nothing, or a network error would stop the wait before a late workflow shows.
 */
export const settled = (runs: CiRun[], again: CiRun[] | undefined): boolean =>
    again !== undefined && again.length === runs.length && verdict(again) === verdict(runs);

export const failedRuns = (runs: CiRun[]): CiRun[] =>
    runs.filter(run => run.status === 'completed' && !PASSING.has(run.conclusion));

// eslint-disable-next-line no-control-regex -- the escape character is what the colour codes start with
const ANSI = /\x1b\[[0-9;]*m/g;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;

/** A `gh run view --log-failed` line as the job printed it: no "job, step, timestamp" prefix, no colour codes. */
export function cleanLogLine(line: string): string {
    const fields = line.split('\t');
    const text = fields.length >= 3 ? fields.slice(2).join('\t') : line;
    return text.replace(TIMESTAMP, '').replace(ANSI, '');
}

/** "CI: checks (push): success" or "CI: site (pull_request): in_progress", one per run. */
export const runLine = (run: CiRun): string =>
    `${run.workflow} (${run.event}): ${run.status === 'completed' ? run.conclusion : run.status}`;

/** `--timeout`'s minutes, or undefined when it is not a finite number above 0 (`Number('1h')` is NaN: no deadline). */
export function parseTimeoutMinutes(value: string): number | undefined {
    const minutes = Number(value);
    return value.trim() !== '' && Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
}

export interface JobLog {
    job: string;
    lines: string[];
}

/**
 * `gh run view --log-failed` output split by job (its first tab-separated field), each cut to its last
 * `tail` lines, cleaned: the combined log's tail alone would show only the last failed job.
 */
export function failedJobLogs(log: string, tail: number): JobLog[] {
    const jobs = new Map<string, string[]>();
    for (const line of log.trimEnd().split('\n')) {
        if (line === '') continue;
        const job = line.includes('\t') ? line.slice(0, line.indexOf('\t')) : '';
        const lines = jobs.get(job) ?? [];
        lines.push(line);
        jobs.set(job, lines);
    }
    return [...jobs].map(([job, lines]) => ({ job, lines: lines.slice(-tail).map(cleanLogLine) }));
}
