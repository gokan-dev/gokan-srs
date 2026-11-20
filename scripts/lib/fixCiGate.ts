// Whether a failed CI run starts the fix-CI agent (claude-fix-ci.yml). Pure: scripts/fix-ci-gate.ts
// gathers the run, the PR and its comments, and acts on the answer.
//
// The agent acts on agent commits too (almost every failure on an agent branch is one), so the loop
// guard is a count, not the commit's author: one attempt per failed commit, and at most
// MAX_FIX_STREAK attempts in a row on a PR before the maintainer is asked.
import { type PrComment, classifyComment, isReset } from './prComments';

/**
 * The events a branch's CI runs on, the only runs the agent acts on. The conventions check
 * (`workflow-run-listener`) holds every workflow claude-fix-ci.yml watches to run on one of them.
 */
export const BRANCH_CI_EVENTS: readonly string[] = ['push', 'pull_request'];

/** Attempts in a row on one PR, with no triage, decision or word from the maintainer between them. */
export const MAX_FIX_STREAK = 3;

export interface FixCiInput {
    /** The CI run that completed. */
    run: {
        id: number;
        conclusion: string;
        event: string;
        headRepository: string;
        headBranch: string;
        headSha: string;
    };
    repository: string;
    defaultBranch: string;
    /** The branch's head now, or null when the branch is gone. */
    branchHead: string | null;
    /** The open PR whose head is the run's branch, if any. */
    pr: { number: number; isDraft: boolean } | null;
    comments: PrComment[];
    /** This fix-CI run: a re-run of it (claude-retry.yml) finds its own attempt and goes on. */
    fixRunId: number;
}

export type FixCiDecision =
    | { kind: 'skip'; reason: string }
    | { kind: 'fix'; pr: number; resumed: boolean }
    | { kind: 'stop'; pr: number; streak: number };

export function decideFixCi(input: FixCiInput): FixCiDecision {
    const { run } = input;
    const skip = (reason: string): FixCiDecision => ({ kind: 'skip', reason });
    if (run.conclusion !== 'failure') return skip(`The run ended ${run.conclusion || 'without a conclusion'}, not in a failure.`);
    if (!BRANCH_CI_EVENTS.includes(run.event)) return skip(`A ${run.event} run is not a branch's CI.`);
    // On a public repository a fork's failing PR must never drive an agent with secrets in scope.
    if (run.headRepository !== input.repository) return skip(`The run is from ${run.headRepository}, a fork.`);
    if (run.headBranch === input.defaultBranch) return skip(`${run.headBranch} is the default branch: no PR to fix.`);
    if (!input.pr) return skip(`No open PR has ${run.headBranch} as its head.`);
    // A draft is still the implement agent's (or a person's): its own run verifies it on CI.
    if (input.pr.isDraft) return skip(`PR #${input.pr.number} is a draft.`);
    // A newer push gets its own CI run, which decides.
    if (input.branchHead !== run.headSha) return skip(`${run.headBranch} moved on from ${run.headSha.slice(0, 10)}.`);

    const events = input.comments.map(classifyComment);
    if (events.some(event => event.kind === 'fix-ci-stop' && event.sha === run.headSha)) {
        return skip(`The maintainer was already asked about ${run.headSha.slice(0, 10)}.`);
    }
    const attempts = events.filter(event => event.kind === 'fix-ci' && event.sha === run.headSha);
    // One attempt sees every failure on the commit (bun run ci:wait), so another workflow failing on it
    // starts no second agent. A re-run of the same attempt is a retry, not a new attempt.
    if (attempts.some(event => event.kind === 'fix-ci' && event.run !== input.fixRunId)) {
        return skip(`${run.headSha.slice(0, 10)} already had a fix attempt.`);
    }
    if (attempts.length > 0) return { kind: 'fix', pr: input.pr.number, resumed: true };

    const lastReset = events.findLastIndex(isReset);
    const streak = new Set(events.slice(lastReset + 1).flatMap(event => (event.kind === 'fix-ci' ? [event.sha] : []))).size;
    if (streak >= MAX_FIX_STREAK) return { kind: 'stop', pr: input.pr.number, streak };
    return { kind: 'fix', pr: input.pr.number, resumed: false };
}
