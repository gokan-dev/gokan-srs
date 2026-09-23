import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GrammarSRSService } from './grammarSrs.service';
import { SRSService } from './srs.service';
import { GrammarService } from './grammar.service';
import { CONSTANTS } from '../commons/constants';
import type { GrammarProgress } from '../models/grammar.model';
import type { VocabProgress } from '../models/vocabulary.model';
import type { UserSettings } from '../models/user.model';

function makeProgress(overrides: Partial<GrammarProgress> = {}): GrammarProgress {
    return {
        grammarId: 'n5-001',
        stage: 'learning',
        introductionAt: new Date('2026-06-01T00:00:00Z'),
        nextReviewAt: null,
        lastReviewedAt: null,
        totalReviews: 0,
        consecutiveFailures: 0,
        entry: {
            memoryStrength: CONSTANTS.srs.formula.minMemoryStrength,
            interval: 0,
            difficulty: 0.5,
            lastReviewedAt: null,
            dueDate: null,
            history: [],
        },
        ...overrides,
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GrammarSRSService.applyGrammarIntroChoice', () => {
    it('learn: sets nextReviewAt and entry.dueDate to now', () => {
        const fresh = GrammarSRSService.createGrammarProgress('n5-001');
        const updated = GrammarSRSService.applyGrammarIntroChoice(fresh, 'learn');

        expect(updated.introductionAt).not.toBeNull();
        expect(updated.nextReviewAt).not.toBeNull();
        expect(updated.entry.dueDate).toEqual(updated.nextReviewAt);
        expect(updated.stage).toBe('learning');
    });

    it('skip: graduates immediately at max memory strength', () => {
        const fresh = GrammarSRSService.createGrammarProgress('n5-001');
        const updated = GrammarSRSService.applyGrammarIntroChoice(fresh, 'skip');

        expect(updated.stage).toBe('graduated');
        expect(updated.nextReviewAt).toBeNull();
        expect(updated.entry.memoryStrength).toBe(CONSTANTS.srs.formula.mastery.maxMemoryStrength);
    });
});

describe('GrammarSRSService.applyAnswer', () => {
    const now = new Date('2026-06-10T00:00:00Z');

    it('updates the single SRS entry and increments totalReviews on a correct answer', () => {
        const progress = makeProgress({ entry: { ...makeProgress().entry, dueDate: now } });
        const { updated, result } = GrammarSRSService.applyAnswer(progress, 'correct', 5000, now);

        expect(result).toBe('correct');
        expect(updated.totalReviews).toBe(1);
        expect(updated.entry.memoryStrength).toBeGreaterThan(progress.entry.memoryStrength);
        expect(updated.needsRetry).toBe(false);
    });

    it('sets needsRetry on a wrong answer without prior retry state', () => {
        const progress = makeProgress();
        const { updated } = GrammarSRSService.applyAnswer(progress, 'wrong', 5000, now);

        expect(updated.needsRetry).toBe(true);
    });

    it('a pending retry does not update SRS state, only clears/keeps the flag', () => {
        const progress = makeProgress({ needsRetry: true });
        const { updated } = GrammarSRSService.applyAnswer(progress, 'correct', 5000, now);

        expect(updated.needsRetry).toBe(false);
        expect(updated.entry.memoryStrength).toBe(progress.entry.memoryStrength);
        expect(updated.totalReviews).toBe(progress.totalReviews);
    });

    it('graduates once the entry reaches max memory strength', () => {
        const progress = makeProgress({
            entry: { ...makeProgress().entry, memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength - 0.001, dueDate: now },
        });
        const { updated } = GrammarSRSService.applyAnswer(progress, 'correct', 1000, now);

        expect(updated.stage).toBe('graduated');
        expect(updated.nextReviewAt).toBeNull();
    });

    it('a reduced strengthDeltaModifier earns a smaller (but still positive) gain than a full one', () => {
        const base = () => makeProgress({ entry: { ...makeProgress().entry, memoryStrength: 100, dueDate: now } });

        const full = GrammarSRSService.applyAnswer(base(), 'correct', 5000, now, 1.0, 1.0, 1.0).updated;
        const reduced = GrammarSRSService.applyAnswer(base(), 'correct', 5000, now, 1.0, 1.0, 0.5).updated;

        expect(full.entry.memoryStrength).toBeGreaterThan(100);
        expect(reduced.entry.memoryStrength).toBeGreaterThan(100);
        expect(reduced.entry.memoryStrength).toBeLessThan(full.entry.memoryStrength);
    });
});

describe('GrammarSRSService.applyVocabReinforcement (positive-only vocab credit)', () => {
    const now = new Date('2026-06-10T00:00:00Z');
    const settings = { learningFrequency: 'medium', enableMeaningQuiz: true } as UserSettings;

    function makeVocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
        const entry = () => ({
            memoryStrength: 100, interval: 1, difficulty: 0.5,
            lastReviewedAt: null, dueDate: now, history: [],
        });
        return {
            vocabId: 'v-1',
            stage: 'learning',
            introductionAt: new Date('2026-06-01T00:00:00Z'),
            nextReviewAt: now,
            lastReviewedAt: null,
            totalReviews: 1,
            consecutiveFailures: 0,
            reading: entry(),
            meaning: entry(),
            // Already activated, so the seed-first path is not what these exercise.
            production: { ...entry(), dueDate: now },
            ...overrides,
        };
    }

    it('boosts the PRODUCTION entry of a credited word and leaves untouched words alone', () => {
        // Filling a grammar blank is English sentence in, Japanese out, which is
        // production. It used to credit reading: the one direction of the three that
        // the exercise structurally cannot test, since a blank shows nothing to read.
        const queue = [makeVocabProgress({ vocabId: 'v-1' }), makeVocabProgress({ vocabId: 'v-2' })];
        const next = GrammarSRSService.applyVocabReinforcement(queue, [{ vocabId: 'v-1', result: 'correct' }], now, settings);

        const v1 = next.find(v => v.vocabId === 'v-1')!;
        const v2 = next.find(v => v.vocabId === 'v-2')!;
        expect(v1.production!.memoryStrength).toBeGreaterThan(100);
        expect(v2).toBe(queue[1]); // reference-equal: untouched
    });

    it('leaves reading and meaning untouched (production-only credit)', () => {
        const queue = [makeVocabProgress({ vocabId: 'v-1' })];
        const next = GrammarSRSService.applyVocabReinforcement(queue, [{ vocabId: 'v-1', result: 'correct' }], now, settings);

        expect(next[0].reading.memoryStrength).toBe(100);
        expect(next[0].meaning.memoryStrength).toBe(100);
    });

    it('credits less than a real production answer would, for the same result', () => {
        // Right direction, easier conditions: the English sentence and the surrounding
        // Japanese narrow the candidates far more than a production card's bare glosses.
        const queue = [makeVocabProgress({ vocabId: 'v-1' })];
        const reinforced = GrammarSRSService.applyVocabReinforcement(queue, [{ vocabId: 'v-1', result: 'correct' }], now, settings);

        const { updated: full } = SRSService.applyAnswer(
            queue[0], 'production', 'base', '', '',
            CONSTANTS.srs.quizProperties.production.expectedLatency, now, 'correct'
        );

        expect(reinforced[0].production!.memoryStrength).toBeGreaterThan(100);
        expect(reinforced[0].production!.memoryStrength).toBeLessThan(full.production!.memoryStrength);
    });

    it('seeds an unactivated production entry before crediting it', () => {
        // A word met first through grammar joins the production rotation at its
        // designed baseline (meaning strength x seedStrengthRatio) rather than at
        // whatever one scaffolded blank happens to compute.
        const inert = makeVocabProgress({
            vocabId: 'v-1',
            meaning: { memoryStrength: 400, interval: 1, difficulty: 0.5, lastReviewedAt: null, dueDate: now, history: [] },
            production: { memoryStrength: 1, interval: 0, difficulty: 0.5, lastReviewedAt: null, dueDate: null, history: [] },
        });
        const next = GrammarSRSService.applyVocabReinforcement([inert], [{ vocabId: 'v-1', result: 'correct' }], now, settings);

        const seedBaseline = 400 * CONSTANTS.srs.production.seedStrengthRatio;
        expect(next[0].production!.memoryStrength).toBeGreaterThan(seedBaseline);
        expect(next[0].production!.dueDate).not.toBeNull();
    });

    it('does nothing when production quizzes are disabled', () => {
        // The exercise trains a direction the user switched off, and crediting reading
        // instead would just restore the mismatch this change exists to remove.
        const queue = [makeVocabProgress({ vocabId: 'v-1' })];
        const off = { ...settings, enableProductionQuiz: false } as UserSettings;

        expect(GrammarSRSService.applyVocabReinforcement(queue, [{ vocabId: 'v-1', result: 'correct' }], now, off)).toBe(queue);
    });

    it('returns the same queue reference when there are no credits', () => {
        const queue = [makeVocabProgress()];
        expect(GrammarSRSService.applyVocabReinforcement(queue, [], now, settings)).toBe(queue);
    });

    it('skips a credit whose word is not in the learning queue', () => {
        const queue = [makeVocabProgress({ vocabId: 'v-1' })];
        const next = GrammarSRSService.applyVocabReinforcement(queue, [{ vocabId: 'v-missing', result: 'correct' }], now, settings);
        expect(next).toBe(queue);
    });
});

describe('GrammarSRSService.deferWithoutCredit', () => {
    const now = new Date('2026-06-10T00:00:00Z');

    it('does not touch memoryStrength, interval, or difficulty', () => {
        const progress = makeProgress({ entry: { ...makeProgress().entry, memoryStrength: 42, interval: 7, difficulty: 0.6 } });
        const updated = GrammarSRSService.deferWithoutCredit(progress, now);

        expect(updated.entry.memoryStrength).toBe(42);
        expect(updated.entry.interval).toBe(7);
        expect(updated.entry.difficulty).toBe(0.6);
    });

    it('reschedules dueDate/nextReviewAt forward so the same ungradable card is not immediately re-served', () => {
        const progress = makeProgress({ entry: { ...makeProgress().entry, dueDate: now } });
        const updated = GrammarSRSService.deferWithoutCredit(progress, now);

        expect(updated.nextReviewAt).not.toBeNull();
        expect(updated.nextReviewAt!.getTime()).toBeGreaterThan(now.getTime());
        expect(updated.entry.dueDate!.getTime()).toBeGreaterThan(now.getTime());
    });

    it('still records lastReviewedAt and increments totalReviews for basic bookkeeping', () => {
        const progress = makeProgress({ totalReviews: 3 });
        const updated = GrammarSRSService.deferWithoutCredit(progress, now);

        expect(updated.lastReviewedAt).toEqual(now);
        expect(updated.totalReviews).toBe(4);
    });
});

describe('GrammarSRSService candidate finding (JLPT order fallback)', () => {
    // The JLPT walk is now only the FALLBACK, used when the dataset's authored
    // teaching order can't be loaded - so every test here stubs the order away
    // explicitly rather than relying on the fetch happening to fail.
    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue(null);
        vi.spyOn(GrammarService, 'loadKinds').mockResolvedValue({});
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});
    });

    // 1 = N1 (hardest) .. 5 = N5 (easiest). Walk order must be N5 -> N1, mirroring vocab's findCandidatesJLPT.
    const mockIndex = {
        1: ['n1-a'],
        2: ['n2-a'],
        3: ['n3-a'],
        4: ['n4-a'],
        5: ['n5-a', 'n5-b'],
    };

    it('walks N5 -> N1', async () => {
        vi.spyOn(GrammarService, 'loadJlptIndex').mockResolvedValue(mockIndex);

        const candidates = await GrammarSRSService.getNextCandidates([], 6);

        expect(candidates).toEqual(['n5-a', 'n5-b', 'n4-a', 'n3-a', 'n2-a', 'n1-a']);
    });

    it('skips grammar points already in the queue', async () => {
        vi.spyOn(GrammarService, 'loadJlptIndex').mockResolvedValue(mockIndex);

        const currentQueue = [makeProgress({ grammarId: 'n5-a' }), makeProgress({ grammarId: 'n4-a' })];
        const candidates = await GrammarSRSService.getNextCandidates(currentQueue, 2);

        expect(candidates).toEqual(['n5-b', 'n3-a']);
    });

    it('respects the ignoredIds set (candidates already fetched this batch)', async () => {
        vi.spyOn(GrammarService, 'loadJlptIndex').mockResolvedValue(mockIndex);

        const candidates = await GrammarSRSService.getNextCandidates([], 2, new Set(['n5-a']));

        expect(candidates).toEqual(['n5-b', 'n4-a']);
    });

    it('countLearnableGrammar counts remaining grammar points not yet queued', async () => {
        vi.spyOn(GrammarService, 'loadJlptIndex').mockResolvedValue(mockIndex);

        const count = await GrammarSRSService.countLearnableGrammar([makeProgress({ grammarId: 'n5-a' })]);

        expect(count).toBe(5);
    });

    it('hasMoreLearnableGrammar is false once every grammar point is queued', async () => {
        vi.spyOn(GrammarService, 'loadJlptIndex').mockResolvedValue({ 1: [], 2: [], 3: [], 4: [], 5: [] });

        expect(await GrammarSRSService.hasMoreLearnableGrammar([])).toBe(false);
    });
});


describe('GrammarSRSService candidate finding (authored teaching order)', () => {
    // Deliberately NOT in JLPT order: the whole point of the authored order is
    // that a register sibling from a harder level (n2-but) can sit next to the
    // N5 point it differs from only in formality, while the alphabetical
    // accident that put connectives first is gone.
    const teachingOrder = {
        order: ['n5-wa', 'n5-wo', 'n5-but', 'n2-but', 'n4-must', 'n1-rare'],
        chapters: [
            { id: 'c01', title: 'Particles', summary: '', jlptLevel: 5, points: ['n5-wa', 'n5-wo'] },
            { id: 'c02', title: 'But', summary: '', jlptLevel: 5, points: ['n5-but', 'n2-but'] },
            { id: 'c03', title: 'Must', summary: '', jlptLevel: 4, points: ['n4-must'] },
            { id: 'c04', title: 'Rare', summary: '', jlptLevel: 1, points: ['n1-rare'] },
        ],
    };

    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue(teachingOrder);
        vi.spyOn(GrammarService, 'loadKinds').mockResolvedValue({});
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});
    });

    it('introduces points in the authored order, not JLPT order', async () => {
        const jlpt = vi.spyOn(GrammarService, 'loadJlptIndex');

        // c01 has exactly 2 points, so a batch of 6 still only yields those 2 -
        // a batch never crosses a chapter boundary (see the dedicated describe
        // block below for that behaviour in isolation).
        const candidates = await GrammarSRSService.getNextCandidates([], 6);

        expect(candidates).toEqual(['n5-wa', 'n5-wo']);
        // The JLPT index must not even be consulted when an order exists.
        expect(jlpt).not.toHaveBeenCalled();
    });

    it('keeps a harder-level register sibling in its authored position within its own chapter', async () => {
        // n2-but is c02's 2nd point - once c01 (n5-wa, n5-wo) is queued, c02 becomes
        // current and n2-but is served right after n5-but, not pushed to the end by
        // a JLPT walk.
        const queue = ['n5-wa', 'n5-wo'].map(id => makeProgress({ grammarId: id }));
        const candidates = await GrammarSRSService.getNextCandidates(queue, 4);
        expect(candidates).toEqual(['n5-but', 'n2-but']);
    });

    it('skips points already queued, without disturbing the order, inside the current chapter', async () => {
        const queue = [makeProgress({ grammarId: 'n5-wa' })];

        const candidates = await GrammarSRSService.getNextCandidates(queue, 3);

        // Still bounded to c01: n5-but/n2-but/n4-must belong to later chapters and
        // must not spill into this batch even though c01 has room left.
        expect(candidates).toEqual(['n5-wo']);
    });

    it('respects ignoredIds within the current chapter', async () => {
        const candidates = await GrammarSRSService.getNextCandidates([], 2, new Set(['n5-wa']));
        expect(candidates).toEqual(['n5-wo']);
    });

    it('stops at maxToFind', async () => {
        expect(await GrammarSRSService.getNextCandidates([], 2)).toHaveLength(2);
        expect(await GrammarSRSService.getNextCandidates([], 0)).toEqual([]);
    });

    it('yields the whole current chapter when asked for its full size (whole-chapter introduction)', async () => {
        // advanceGrammarQueue sizes its request to getCurrentChapter().points.length,
        // so one advance introduces the entire current chapter rather than a fixed
        // batch. This is the composition it relies on.
        const chapter = await GrammarSRSService.getCurrentChapter([]);
        expect(chapter?.id).toBe('c01');
        expect(chapter?.points.length).toBe(2);

        const candidates = await GrammarSRSService.getNextCandidates([], chapter!.points.length);
        expect(candidates).toEqual(['n5-wa', 'n5-wo']);
    });

    it('countLearnableGrammar counts every remaining chapter, not just the current one', async () => {
        // countLearnableGrammar is deliberately NOT chapter-bound (it answers "is
        // there more content at all", for the hub's moreNew signal) while
        // getNextCandidates now is - the two are allowed to disagree in size.
        const queue = [makeProgress({ grammarId: 'n5-wa' })];

        const count = await GrammarSRSService.countLearnableGrammar(queue);
        const candidates = await GrammarSRSService.getNextCandidates(queue, 1000);

        expect(count).toBe(5);
        expect(candidates).toEqual(['n5-wo']);
    });

    it('countLearnableGrammar honours its early-exit limit', async () => {
        expect(await GrammarSRSService.countLearnableGrammar([], 2)).toBe(2);
        expect(await GrammarSRSService.hasMoreLearnableGrammar([])).toBe(true);
    });

    it('hasMoreLearnableGrammar is false once every ordered point is queued', async () => {
        const queue = teachingOrder.order.map(id => makeProgress({ grammarId: id }));
        expect(await GrammarSRSService.hasMoreLearnableGrammar(queue)).toBe(false);
    });
});

describe('GrammarSRSService candidate finding stops at a chapter boundary', () => {
    const teachingOrder = {
        order: ['n5-wa', 'n5-wo', 'n5-but', 'n2-but', 'n4-must'],
        chapters: [
            { id: 'c01', title: 'Particles', summary: '', jlptLevel: 5, points: ['n5-wa', 'n5-wo'] },
            { id: 'c02', title: 'But', summary: '', jlptLevel: 5, points: ['n5-but', 'n2-but'] },
            { id: 'c03', title: 'Must', summary: '', jlptLevel: 4, points: ['n4-must'] },
        ],
    };

    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue(teachingOrder);
        vi.spyOn(GrammarService, 'loadKinds').mockResolvedValue({});
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});
    });

    it('a batch never crosses a chapter boundary even with room left', async () => {
        const candidates = await GrammarSRSService.getNextCandidates([], 3);
        // c01 has only 2 points - the 3rd slot is NOT filled from c02.
        expect(candidates).toEqual(['n5-wa', 'n5-wo']);
    });

    it('a chapter with fewer points remaining than the batch size yields only that remainder', async () => {
        const queue = [makeProgress({ grammarId: 'n5-wa' })];
        const candidates = await GrammarSRSService.getNextCandidates(queue, 3);
        expect(candidates).toEqual(['n5-wo']);
    });

    it('the next chapter is only entered on a following call, once the current one is exhausted', async () => {
        const afterC01 = ['n5-wa', 'n5-wo'].map(id => makeProgress({ grammarId: id }));
        const candidates = await GrammarSRSService.getNextCandidates(afterC01, 3);
        expect(candidates).toEqual(['n5-but', 'n2-but']);
    });

    it('getCurrentChapter reports the chapter of the next teachable, unqueued point', async () => {
        expect((await GrammarSRSService.getCurrentChapter([]))?.id).toBe('c01');

        const afterC01 = ['n5-wa', 'n5-wo'].map(id => makeProgress({ grammarId: id }));
        expect((await GrammarSRSService.getCurrentChapter(afterC01))?.id).toBe('c02');

        const everything = teachingOrder.order.map(id => makeProgress({ grammarId: id }));
        expect(await GrammarSRSService.getCurrentChapter(everything)).toBeNull();
    });
});


describe('GrammarSRSService pipeline filtering by kind', () => {
    const teachingOrder = {
        order: ['n5-wa', 'n5-te', 'n5-wo', 'n4-causative', 'n4-node'],
        chapters: [
            { id: 'c01', title: 'Particles', summary: '', jlptLevel: 5, points: ['n5-wa', 'n5-te', 'n5-wo'] },
            { id: 'c02', title: 'More', summary: '', jlptLevel: 4, points: ['n4-causative', 'n4-node'] },
        ],
    };
    // n5-te (the て-form) and n4-causative teach a derivation: the answer differs
    // per verb, so the cloze quiz has nothing invariant to blank.
    const kinds = {
        'n5-wa': 'construction', 'n5-te': 'inflection', 'n5-wo': 'construction',
        'n4-causative': 'inflection', 'n4-node': 'construction',
    } as const;

    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue(teachingOrder);
        vi.spyOn(GrammarService, 'loadKinds').mockResolvedValue({ ...kinds });
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});
    });

    it('never introduces an inflection point while only the cloze quiz exists', async () => {
        // c01 (n5-wa, n5-te, n5-wo) is the current chapter - n5-te is skipped as
        // untestable, n4-node belongs to c02 and is out of reach until c01 is
        // fully queued (see the chapter-boundary describe block above).
        const candidates = await GrammarSRSService.getNextCandidates([], 10);

        expect(candidates).toEqual(['n5-wa', 'n5-wo']);
        expect(candidates).not.toContain('n5-te');
        expect(candidates).not.toContain('n4-causative');
    });

    it('excludes them from countLearnableGrammar too, so the hub agrees with the queue', async () => {
        // countLearnableGrammar counts every remaining chapter (3 CONSTRUCTION
        // points total); getNextCandidates only serves the current one (2).
        const count = await GrammarSRSService.countLearnableGrammar([]);
        const candidates = await GrammarSRSService.getNextCandidates([], 1000);

        expect(count).toBe(3);
        expect(candidates).toEqual(['n5-wa', 'n5-wo']);
    });

    it('reports no more learnable grammar once every CONSTRUCTION is queued', async () => {
        // The inflection points are still unqueued, but they are not learnable,
        // so the activity must not advertise itself as having material left.
        const queue = ['n5-wa', 'n5-wo', 'n4-node'].map(id => makeProgress({ grammarId: id }));
        expect(await GrammarSRSService.hasMoreLearnableGrammar(queue)).toBe(false);
    });

    it('treats everything as learnable when the kinds index is unavailable', async () => {
        // Failure direction matters: a missing index must not silently empty the
        // learning queue. Still chapter-bounded (n5-te is now teachable and c01's
        // full 3 points come back), since kind filtering and chapter bounding are
        // independent axes.
        vi.spyOn(GrammarService, 'loadKinds').mockResolvedValue({});

        const candidates = await GrammarSRSService.getNextCandidates([], 10);

        expect(candidates).toEqual(['n5-wa', 'n5-te', 'n5-wo']);
    });

    it('filters the JLPT fallback path by kind as well', async () => {
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue(null);
        vi.spyOn(GrammarService, 'loadJlptIndex').mockResolvedValue({
            1: [], 2: [], 3: [], 4: ['n4-causative', 'n4-node'], 5: ['n5-wa', 'n5-te', 'n5-wo'],
        });

        const candidates = await GrammarSRSService.getNextCandidates([], 10);

        expect(candidates).toEqual(['n5-wa', 'n5-wo', 'n4-node']);
    });
});

describe('GrammarSRSService gates inflection points on DATA, not on kind', () => {
    const teachingOrder = {
        order: ['n5-wa', 'n5-te', 'n4-causative'],
        chapters: [{ id: 'c01', title: 'x', summary: '', jlptLevel: 5, points: ['n5-wa', 'n5-te', 'n4-causative'] }],
    };
    const kinds = { 'n5-wa': 'construction', 'n5-te': 'inflection', 'n4-causative': 'inflection' } as const;

    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue(teachingOrder);
        vi.spyOn(GrammarService, 'loadKinds').mockResolvedValue({ ...kinds });
    });

    it('introduces an inflection point once the transformation drill has items for it', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({
            'n5-te': {
                form: 'te', formLabel: 'て-form',
                items: [{ vocabId: 'v1', lemma: '飲む', lemmaReading: 'のむ', target: '飲んで', targetReading: 'のんで', wordClass: 'godan' }],
            },
        });

        const candidates = await GrammarSRSService.getNextCandidates([], 10);

        expect(candidates).toContain('n5-te');
        // Still excluded: classified as needing the drill, but no items exist for it.
        expect(candidates).not.toContain('n4-causative');
    });

    it('keeps an inflection point out when the drill has no items for it', async () => {
        // The n1-178 case: gating on kind alone would serve an unanswerable card.
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({
            'n5-te': { form: 'te', formLabel: 'て-form', items: [] },
        });

        expect(await GrammarSRSService.getNextCandidates([], 10)).toEqual(['n5-wa']);
    });

    it('fails closed when the conjugation index cannot be loaded', async () => {
        // Opposite direction to the kinds index on purpose: no items means no
        // inflection point is served, rather than serving cards with no question.
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});

        expect(await GrammarSRSService.getNextCandidates([], 10)).toEqual(['n5-wa']);
    });

    it('countLearnableGrammar agrees with the data gate', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({
            'n5-te': {
                form: 'te', formLabel: 'て-form',
                items: [{ vocabId: 'v1', lemma: '飲む', lemmaReading: 'のむ', target: '飲んで', targetReading: 'のんで', wordClass: 'godan' }],
            },
        });

        const count = await GrammarSRSService.countLearnableGrammar([]);
        const candidates = await GrammarSRSService.getNextCandidates([], 1000);

        expect(count).toBe(2);
        expect(candidates).toHaveLength(count);
    });
});
