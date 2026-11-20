import { describe, expect, it } from 'vitest';
import { type FixCiInput, MAX_FIX_STREAK, decideFixCi } from './fixCiGate';
import { DECISION_MARKER, type PrComment, fixCiMarker, fixCiStopMarker, triageMarker } from './prComments';

const SHA = 'a'.repeat(40);

function input(overrides: Partial<FixCiInput> = {}, run: Partial<FixCiInput['run']> = {}): FixCiInput {
    return {
        run: {
            id: 10,
            conclusion: 'failure',
            event: 'push',
            headRepository: 'gokan-dev/gokan-srs',
            headBranch: 'agent/issue-7',
            headSha: SHA,
            ...run,
        },
        repository: 'gokan-dev/gokan-srs',
        defaultBranch: 'main',
        branchHead: SHA,
        pr: { number: 263, isDraft: false },
        comments: [],
        fixRunId: 99,
        ...overrides,
    };
}

const bot = (body: string): PrComment => ({ type: 'Bot', body });
const person = (body: string): PrComment => ({ type: 'User', body });

describe('decideFixCi', () => {
    it('fixes a failed push run on an agent branch: no author filter (PR #265 waited 3 hours)', () => {
        expect(decideFixCi(input())).toEqual({ kind: 'fix', pr: 263, resumed: false });
    });

    it('fixes a pull_request run too', () => {
        expect(decideFixCi(input({}, { event: 'pull_request' })).kind).toBe('fix');
    });

    it('skips what is not a failure, not a branch CI run, a fork, the default branch, a draft or no PR', () => {
        expect(decideFixCi(input({}, { conclusion: 'success' })).kind).toBe('skip');
        expect(decideFixCi(input({}, { conclusion: 'cancelled' })).kind).toBe('skip');
        expect(decideFixCi(input({}, { event: 'workflow_dispatch' })).kind).toBe('skip');
        expect(decideFixCi(input({}, { headRepository: 'someone/gokan-srs' })).kind).toBe('skip');
        expect(decideFixCi(input({}, { headBranch: 'main' })).kind).toBe('skip');
        expect(decideFixCi(input({ pr: null })).kind).toBe('skip');
        expect(decideFixCi(input({ pr: { number: 263, isDraft: true } })).kind).toBe('skip');
    });

    it('skips a commit the branch has moved past: the newer push has its own CI run', () => {
        expect(decideFixCi(input({ branchHead: 'b'.repeat(40) })).kind).toBe('skip');
        expect(decideFixCi(input({ branchHead: null })).kind).toBe('skip');
    });

    it('makes one attempt a commit, whichever workflow failed on it', () => {
        const comments = [bot(fixCiMarker(SHA, 50))];
        expect(decideFixCi(input({ comments }))).toMatchObject({ kind: 'skip' });
    });

    it('goes on when the attempt on this commit is its own, re-run by claude-retry.yml', () => {
        const comments = [bot(fixCiMarker(SHA, 99))];
        expect(decideFixCi(input({ comments }))).toEqual({ kind: 'fix', pr: 263, resumed: true });
    });

    it('asks the maintainer after MAX_FIX_STREAK attempts in a row on other commits', () => {
        const comments = ['1', '2', '3'].map(c => bot(fixCiMarker(c.repeat(40), 1)));
        expect(comments).toHaveLength(MAX_FIX_STREAK);
        expect(decideFixCi(input({ comments }))).toEqual({ kind: 'stop', pr: 263, streak: 3 });
        expect(decideFixCi(input({ comments: comments.slice(1) })).kind).toBe('fix');
    });

    it('counts an attempt per commit, not per re-run', () => {
        const comments = [bot(fixCiMarker('1'.repeat(40), 1)), bot(fixCiMarker('1'.repeat(40), 1)), bot(fixCiMarker('2'.repeat(40), 2))];
        expect(decideFixCi(input({ comments })).kind).toBe('fix');
    });

    it('restarts the count after a triage, a decision or a word from the maintainer', () => {
        const three = ['1', '2', '3'].map(c => bot(fixCiMarker(c.repeat(40), 1)));
        for (const reset of [person(triageMarker('c'.repeat(40), 'done')), person(DECISION_MARKER), person('Looks wrong, see the log.')]) {
            expect(decideFixCi(input({ comments: [...three, reset] })).kind).toBe('fix');
        }
        // An automatic round is not the maintainer speaking.
        expect(decideFixCi(input({ comments: [...three, person(triageMarker('c'.repeat(40), 'apply'))] })).kind).toBe('stop');
    });

    it('asks the maintainer once a commit', () => {
        const comments = [...['1', '2', '3'].map(c => bot(fixCiMarker(c.repeat(40), 1))), bot(fixCiStopMarker(SHA))];
        expect(decideFixCi(input({ comments })).kind).toBe('skip');
    });
});
