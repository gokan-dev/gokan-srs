import { describe, expect, it } from 'vitest';
import { DECISION_MARKER, type PrComment, triageMarker } from './prComments';
import { decideRound } from './triageRound';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

const triage = (sha: string, outcome: string): PrComment => ({ type: 'User', body: `${triageMarker(sha, outcome)}\n@claude please apply` });
const decision: PrComment = { type: 'User', body: `${DECISION_MARKER}\n@claude please apply the brief` };
const person = (body: string): PrComment => ({ type: 'User', body });
const review: PrComment = { type: 'Bot', body: 'Review of PR #263' };

describe('decideRound', () => {
    it('triages a new commit as round one', () => {
        expect(decideRound([review], A, false)).toEqual({ kind: 'triage', repeat: null, finishing: false, autoRounds: 0, lastDefects: null, carried: '', round: 1 });
    });

    it('triages a commit once', () => {
        expect(decideRound([triage(A, 'apply')], A, false).kind).toBe('skip');
    });

    it('allows one repeat after a lone apply or finish that pushed nothing', () => {
        expect(decideRound([triage(A, 'apply')], A, true)).toMatchObject({ kind: 'triage', repeat: 'apply', round: 2 });
        expect(decideRound([triage(A, 'finish')], A, true)).toMatchObject({ kind: 'triage', repeat: 'finish', finishing: false });
        expect(decideRound([triage(A, 'apply'), triage(A, 'decide')], A, true).kind).toBe('skip');
    });

    it('allows a triage after a decision that pushed nothing, so a "stop" can end in done (PR #263)', () => {
        expect(decideRound([triage(A, 'decide'), decision], A, true)).toMatchObject({ kind: 'triage', repeat: 'decision' });
        // After a repeat that already became a decide, the next answer may still end it.
        expect(decideRound([triage(A, 'apply'), triage(A, 'decide'), decision], A, true)).toMatchObject({ kind: 'triage', repeat: 'decision' });
        // No decision yet, or one already triaged: nothing to repeat.
        expect(decideRound([triage(A, 'decide')], A, true).kind).toBe('skip');
        expect(decideRound([triage(A, 'decide'), decision, triage(A, 'done')], A, true).kind).toBe('skip');
    });

    it('counts automatic rounds since the maintainer last spoke', () => {
        expect(decideRound([triage(A, 'apply'), triage(B, 'apply')], C, false)).toMatchObject({ autoRounds: 2, round: 3 });
        expect(decideRound([triage(A, 'apply'), person('ok'), triage(B, 'apply')], C, false)).toMatchObject({ autoRounds: 1 });
        expect(decideRound([triage(A, 'apply'), triage(B, 'decide'), decision], C, false)).toMatchObject({ autoRounds: 0 });
        // The staging reviewer's status is posted by a member but is not the maintainer.
        expect(decideRound([triage(A, 'apply'), person('<!-- gokan-agent-status -->\nstaging ok')], C, false)).toMatchObject({ autoRounds: 1 });
    });

    it('reads the defects the last automatic apply set out to fix, as posted', () => {
        const withDefects = (sha: string, defects: number, polish: number): PrComment => ({
            type: 'User',
            body: [
                triageMarker(sha, 'apply'),
                '@claude please apply',
                '',
                '## Apply',
                ...Array.from({ length: defects }, (_, i) => `### ${i + 1}. Fix ${i} (defect)\nWhere.`),
                ...Array.from({ length: polish }, (_, i) => `### ${defects + i + 1}. Polish ${i} (polish)\nWhy.`),
                '',
                '## Left for one final pass',
                '### 9. Not counted (defect)',
            ].join('\n'),
        });
        expect(decideRound([withDefects(A, 3, 1), withDefects(B, 2, 4)], C, false)).toMatchObject({ autoRounds: 2, lastDefects: 2 });
        // A finish hands over no defect: the apply before it is what the next brief must beat.
        expect(decideRound([withDefects(A, 2, 0), triage(B, 'finish')], C, false)).toMatchObject({ lastDefects: 2 });
        // The maintainer spoke since: nothing to compare with.
        expect(decideRound([withDefects(A, 2, 0), person('go on')], C, false)).toMatchObject({ lastDefects: null });
        // A round-1 apply of polish alone sets no bar: round 2's first defect is not "no fewer than 0".
        expect(decideRound([withDefects(A, 0, 3)], B, false)).toMatchObject({ autoRounds: 1, lastDefects: null });
    });

    it('carries the points set aside since the last finish', () => {
        const setAside = (sha: string, outcome: string, points: string): PrComment => ({
            type: 'User',
            body: `${triageMarker(sha, outcome)}\n@claude please apply\n\n## Apply\n### 1. Fix (defect)\nX.\n\n## Left for one final pass\n${points}\n\n## Not in this change\n- y`,
        });
        const gate = decideRound([setAside(A, 'apply', '### 2. Old polish\nApplied already.'), triage(B, 'finish'), setAside(B, 'apply', '### 3. Reword\nClearer.')], C, false);
        expect(gate).toMatchObject({ carried: '### 3. Reword\nClearer.' });
        expect(decideRound([review], A, false)).toMatchObject({ carried: '' });
    });

    it('finishes the push that followed a finish brief, and a fix of it', () => {
        expect(decideRound([triage(A, 'finish')], B, false)).toMatchObject({ kind: 'triage', finishing: true });
        expect(decideRound([triage(A, 'finish'), review], C, false)).toMatchObject({ finishing: true });
        // The maintainer spoke since: a normal triage.
        expect(decideRound([triage(A, 'finish'), person('one more thing')], B, false)).toMatchObject({ finishing: false });
        expect(decideRound([triage(A, 'apply')], B, false)).toMatchObject({ finishing: false });
    });
});
