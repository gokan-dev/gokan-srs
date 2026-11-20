import { describe, expect, it } from 'vitest';
import { type OutcomeInput, FINAL_PASS_HEADING, parseBrief, renderBrief, resolveOutcome, trackerNote, triageComment } from './triageOutcome';

const SHA = 'a'.repeat(40);

const BRIEF = `## Apply
### 1. Share the count helper (defect)
Two copies in a.ts:3 and b.ts:9.

### 2. Format the number with a thin space (polish)
Reads better.

## Decided by default (reversible)
### 3. Order the rows by frequency
Chose frequency because it matches the dictionary. Reversible: say so on this PR to change it.

## Not in this change
- The header colour: app-wide.
`;

const DEFAULTS_ONLY = `## Decided by default (reversible)
### 1. Order the rows by frequency
Chose frequency.
`;

const YOUR_CALL = `## Your call
### 1. Store the setting?
A stored shape is costly to change.
- [ ] **A**: Yes (recommended)
- [ ] **B**: No
`;

function resolve(markdown: string, overrides: Partial<OutcomeInput> = {}) {
    return resolveOutcome({ brief: parseBrief(markdown), round: 1, autoRounds: 0, maxAutoRounds: 2, repeat: null, finishing: false, ...overrides });
}

describe('parseBrief', () => {
    it('reads the sections, the points and their kind', () => {
        const brief = parseBrief(BRIEF);
        expect(brief.apply.map(p => [p.number, p.title, p.polish])).toEqual([[1, 'Share the count helper', false], [2, 'Format the number with a thin space', true]]);
        expect(brief.apply[0].text).toBe('Two copies in a.ts:3 and b.ts:9.');
        expect(brief.defaults.map(p => p.number)).toEqual([3]);
        expect(brief.notInChange).toBe('- The header colour: app-wide.');
    });

    it('keeps a done brief\'s line and defuses any mention of the agent', () => {
        const brief = parseBrief('The reviews found nothing. @Claude was not needed.\n');
        expect(brief.summary).toBe('The reviews found nothing. Claude was not needed.');
        expect(brief.apply).toEqual([]);
    });

    it('drops a kind marker written inside the heading, so the posted brief does not carry two', () => {
        const brief = parseBrief('## Apply\n### 1. Share the helper (polish): two copies\nIn a.ts.\n');
        expect(brief.apply[0]).toMatchObject({ title: 'Share the helper: two copies', polish: false });
        expect(renderBrief(brief, [])).toContain('### 1. Share the helper: two copies (defect)\n');
    });

    it('refuses an unknown section or a section without points', () => {
        expect(() => parseBrief('## Maybe\n- x\n')).toThrow(/unknown section/);
        expect(() => parseBrief('## Apply\nFix the count.\n')).toThrow(/no "### n/);
    });
});

describe('resolveOutcome', () => {
    it('applies a defect, polish included, in round one', () => {
        const r = resolve(BRIEF);
        expect(r.outcome).toBe('apply');
        expect(r.brief.apply.map(p => p.number)).toEqual([1, 2]);
        expect(r.deferred).toEqual([]);
    });

    it('from round two, leaves polish for the final pass beside a defect', () => {
        const r = resolve(BRIEF, { round: 2 });
        expect(r.outcome).toBe('apply');
        expect(r.brief.apply.map(p => p.number)).toEqual([1]);
        expect(r.deferred.map(p => p.number)).toEqual([2]);
    });

    it('from round two, ends a round of polish and defaults in done (PR #263 rounds 3 and 4)', () => {
        const polishOnly = BRIEF.replace('(defect)', '(polish)');
        const r = resolve(polishOnly, { round: 3 });
        expect(r.outcome).toBe('done');
        expect(r.deferred.map(p => p.number)).toEqual([1, 2, 3]);
        expect(resolve(DEFAULTS_ONLY, { round: 2 }).outcome).toBe('done');
    });

    it('finishes a round one of only defaults instead of starting a full round', () => {
        const r = resolve(DEFAULTS_ONLY);
        expect(r.outcome).toBe('finish');
        expect(r.brief.defaults.map(p => p.number)).toEqual([1]);
    });

    it('ends a repeat with only defaults in done: they were answered without a push', () => {
        const r = resolve(DEFAULTS_ONLY, { repeat: 'finish' });
        expect(r.outcome).toBe('done');
        expect(r.deferred.map(p => p.number)).toEqual([1]);
    });

    it('sorts the review of a finish\'s push with the round 2+ bar, and never finishes it again', () => {
        // A regression in how the defaults were applied is a defect: another round, not done.
        expect(resolve(BRIEF, { round: 2, finishing: true })).toMatchObject({ outcome: 'apply' });
        expect(resolve(BRIEF.replace('(defect)', '(polish)'), { round: 2, finishing: true })).toMatchObject({ outcome: 'done' });
        // The round number alone would not hold it: a finishing round is late whatever its count.
        expect(resolve(DEFAULTS_ONLY, { finishing: true }).outcome).toBe('done');
        expect(resolve(YOUR_CALL, { round: 2, finishing: true }).outcome).toBe('decide');
    });

    it('asks when a point is the maintainer\'s call, whatever else is there', () => {
        expect(resolve(`${BRIEF}\n${YOUR_CALL.replace('### 1.', '### 4.')}`).outcome).toBe('decide');
        expect(resolve(YOUR_CALL, { round: 5 })).toMatchObject({ outcome: 'decide', escalation: null });
    });

    it('turns an apply into a decide after the automatic rounds, or on a repeat', () => {
        expect(resolve(BRIEF, { autoRounds: 2 })).toMatchObject({ outcome: 'decide', escalation: 'rounds' });
        expect(resolve(BRIEF, { repeat: 'apply' })).toMatchObject({ outcome: 'decide', escalation: 'repeat' });
        expect(resolve(BRIEF, { repeat: 'decision' })).toMatchObject({ outcome: 'decide', escalation: 'repeat' });
    });

    it('is done when nothing is left', () => {
        expect(resolve('The reviews found nothing to change.\n')).toMatchObject({ outcome: 'done', deferred: [] });
    });
});

describe('triageComment', () => {
    const base = { sha: SHA, tag: '', human: 'maintainer', autoRounds: 0, maxAutoRounds: 2, repeat: null, onRelease: false };

    it('starts with the marker the gates read, and only an apply or finish asks the agent', () => {
        for (const [markdown, outcome, asks] of [[BRIEF, 'apply', true], [DEFAULTS_ONLY, 'finish', true], [YOUR_CALL, 'decide', false], ['Nothing.', 'done', false]] as const) {
            const body = triageComment({ ...base, resolution: resolve(markdown) });
            expect(body.split('\n')[0]).toBe(`<!-- gokan-triage sha=${SHA} outcome=${outcome} -->`);
            expect(body.includes('@claude')).toBe(asks);
        }
    });

    it('lists the points left for the final pass apart from the ones to apply', () => {
        const body = triageComment({ ...base, resolution: resolve(BRIEF, { round: 2 }) });
        expect(body.indexOf(`## ${FINAL_PASS_HEADING}`)).toBeGreaterThan(body.indexOf('### 1. Share'));
        expect(body.indexOf('### 2. Format')).toBeGreaterThan(body.indexOf(`## ${FINAL_PASS_HEADING}`));
    });

    it('mentions nobody for a sprint member that is done', () => {
        expect(triageComment({ ...base, onRelease: true, resolution: resolve('Nothing.') })).not.toContain('@maintainer');
        expect(triageComment({ ...base, resolution: resolve('Nothing.') })).toContain('@maintainer **Ready to merge.**');
    });

    it('offers to stop when it escalates, and says why', () => {
        const body = triageComment({ ...base, repeat: 'decision', resolution: resolve(BRIEF, { repeat: 'decision' }) });
        expect(body).toContain('Your answer on');
        expect(body).toContain('**B**: Stop here');
        expect(body).toContain('- [ ] **Send my choices to the agent**');
    });
});

describe('the tracker', () => {
    it('records the deferred points on the release tracker', () => {
        const note = trackerNote(263, resolve(BRIEF, { round: 2 }).deferred);
        expect(note).toContain('<!-- gokan-final-pass pr=263 -->');
        expect(note).toContain('### 2. Format the number with a thin space\nReads better.');
    });

    it('renders a brief it parsed back to the same sections', () => {
        const brief = parseBrief(BRIEF);
        expect(parseBrief(renderBrief(brief, []))).toEqual(brief);
    });
});
