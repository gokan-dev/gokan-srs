// What CI said about one commit, read from `gh run list --json` (scripts/ci-wait.ts). Pure, so the
// waiting script is only I/O: which runs count, whether they are done, and what they concluded.
import { isRecord } from './actions';

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

/** The latest run of each verification workflow on `sha`: a re-run or a later attempt replaces an earlier one. */
export function latestCiRuns(runs: CiRun[], sha: string): CiRun[] {
    const latest = new Map<string, CiRun>();
    for (const run of runs) {
        if (run.headSha !== sha || !isVerification(run)) continue;
        const seen = latest.get(run.workflow);
        if (!seen || run.id > seen.id) latest.set(run.workflow, run);
    }
    return [...latest.values()].sort((a, b) => a.workflow.localeCompare(b.workflow));
}

/** Pending while any run is unfinished or none has started; passed only when every run passed. */
export function verdict(runs: CiRun[]): Verdict {
    if (runs.length === 0 || runs.some(run => run.status !== 'completed')) return 'pending';
    return runs.every(run => PASSING.has(run.conclusion)) ? 'passed' : 'failed';
}

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

/** "CI: checks: success" or "CI: site: in_progress", one per run. */
export const runLine = (run: CiRun): string =>
    `${run.workflow}: ${run.status === 'completed' ? run.conclusion : run.status}`;
