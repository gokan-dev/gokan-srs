import { describe, it, expect } from 'vitest';
import { selectNextView, selectCurrentProgress, selectCurrentSentence, selectSessionStats, capSessionCommit, collectActionableTaskKeys, selectNextSessionPreview } from './quizSelectors';
import { initialState, taskKey } from './quizReducer';
import type { QuizState, TaskKey } from './quizReducer';
import type { UserProgress, UserSettings } from '../../models/user.model';
import type { Vocabulary, VocabProgress } from '../../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../../models/vocabulary.model';
import type { Sentence } from '../../models/sentence.model';
import { CONSTANTS } from '../../commons/constants';

const now = new Date('2026-06-10T00:00:00Z');
const past = new Date('2026-06-01T00:00:00Z');
const future = new Date('2026-07-01T00:00:00Z');

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
    return {
        preferredLearningOrder: 'frequency',
        kanjiCoverageTarget: 1,
        enableMeaningQuiz: true,
        learningFrequency: 'medium',
        ...overrides,
    } as UserSettings;
}

function makeProgress(learningQueue: VocabProgress[] = []): UserProgress {
    return {
        kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set(['日']) },
        learningQueue,
        grammarQueue: [],
        stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
        dailyOverride: false,
        adaptive: { level: 1.0, history: [] },
    };
}

function makeVocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return {
        ...DEFAULT_VOCABULARY_PROGRESS,
        vocabId: 'v1',
        stage: 'learning',
        introductionAt: past,
        totalReviews: 1,
        ...overrides,
    };
}

function makeVocab(id = 'v1'): Vocabulary {
    return {
        id,
        writtenForm: { kanji: '日本', alternatives: [], containedKanji: ['日', '本'] },
        reading: { primary: 'にほん', alternatives: [] },
        frequency: { kanjiRank: 1 },
        progression: { kklcStep: 1 },
        senses: [{ pos: ['n'], misc: { rawTags: [] }, glosses: ['Japan'], related: { compounds: [] } }],
    };
}

describe('selectNextView', () => {
    it('returns exhausted with a null queueItem when there is no progress/settings', () => {
        const result = selectNextView(initialState, false, now);
        expect(result.sessionState).toBe('exhausted');
        expect(result.queueItem).toBeNull();
    });

    it('prioritizes an unfinished intro batch over due reviews', () => {
        const introVocab = makeVocab('intro-1');
        const dueItem = makeVocabProgress({
            vocabId: 'due-1',
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: past },
        });
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([dueItem]),
            settings: makeSettings(),
            introCandidates: [introVocab],
        };

        const result = selectNextView(state, false, now);
        expect(result.queueItem).toEqual({ vocabId: 'intro-1', quizType: 'reading', quizMode: 'base' });
    });

    it('reports sessionState "review" when a due item exists', () => {
        const dueItem = makeVocabProgress({ nextReviewAt: past, reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: past } });
        const state: QuizState = { ...initialState, progress: makeProgress([dueItem]), settings: makeSettings() };

        const result = selectNextView(state, false, now);
        expect(result.sessionState).toBe('review');
        expect(result.queueItem).not.toBeNull();
    });

    it('reports sessionState "learn" when nothing is due but more vocab is learnable', () => {
        const state: QuizState = { ...initialState, progress: makeProgress([]), settings: makeSettings() };
        const result = selectNextView(state, /* hasMoreLearnable */ true, now);
        expect(result.sessionState).toBe('learn');
    });

    it('reports sessionState "learn-kanji" when nothing is learnable but a kanji unlock is pending', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([]),
            settings: makeSettings(),
            nextKanjiToLearn: { step: 11, kanjis: ['月'] },
        };
        const result = selectNextView(state, false, now);
        expect(result.sessionState).toBe('learn-kanji');
    });

    it('reports sessionState "waiting" with the earliest upcoming review date when nothing is due/learnable', () => {
        const upcoming = makeVocabProgress({ vocabId: 'later', nextReviewAt: future, stage: 'learning' });
        const state: QuizState = { ...initialState, progress: makeProgress([upcoming]), settings: makeSettings() };
        const result = selectNextView(state, false, now);

        expect(result.sessionState).toBe('waiting');
        expect(result.nextReviewAt).toEqual(future);
    });

    it('reports sessionState "exhausted" when there is nothing due, learnable, or upcoming', () => {
        const state: QuizState = { ...initialState, progress: makeProgress([]), settings: makeSettings() };
        const result = selectNextView(state, false, now);
        expect(result.sessionState).toBe('exhausted');
    });

    it('never surfaces a meaning-only-due item as sessionState "review" when meaning quizzes are disabled', () => {
        // Regression guard for the meaning-quiz-disabled scheduling strand fixed in Phase 2:
        // vocabNextReviewAt/applyAnswer now keep nextReviewAt consistent with what
        // getNextVocabToStudy will actually surface, so this must never disagree.
        const meaningOnlyDue = makeVocabProgress({
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength, dueDate: null },
            meaning: { ...DEFAULT_VOCABULARY_PROGRESS.meaning, dueDate: past },
        });
        const state: QuizState = { ...initialState, progress: makeProgress([meaningOnlyDue]), settings: makeSettings({ enableMeaningQuiz: false }) };

        const result = selectNextView(state, false, now);
        expect(result.sessionState).not.toBe('review');
        expect(result.queueItem).toBeNull();
    });

    it('stays on the meaning quiz when a reading retry becomes actionable mid-meaning-batch', () => {
        // Regression test: a reading item flips needsRetry.reading (or simply comes
        // due) WHILE the user is in the middle of a run of meaning quizzes. Without
        // the "stay on the current phase" hint, getNextVocabToStudy's unconditional
        // reading-first priority would hijack the very next card with a surprise
        // reading quiz, even though the user is mid-meaning-batch.
        const meaningDue = makeVocabProgress({
            vocabId: 'meaning-item',
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: null },
            meaning: { ...DEFAULT_VOCABULARY_PROGRESS.meaning, dueDate: past },
        });
        const readingRetry = makeVocabProgress({
            vocabId: 'reading-retry-item',
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: null },
            // Explicit (not spread from the shared DEFAULT_VOCABULARY_PROGRESS.meaning
            // object) - other test files mutate that shared nested object, which made
            // this test flaky depending on run order/suite composition.
            meaning: { ...DEFAULT_VOCABULARY_PROGRESS.meaning, dueDate: null },
            needsRetry: { reading: true },
        });
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([meaningDue, readingRetry]),
            settings: makeSettings(),
            // Currently showing a meaning card - this is the "phase" hint.
            currentQuizItem: { vocab: meaningDue, quizType: 'meaning', quizMode: 'base' },
        };

        const result = selectNextView(state, false, now);
        expect(result.queueItem?.quizType).toBe('meaning');
        expect(result.queueItem?.vocab?.vocabId).toBe('meaning-item');
    });

    it('switches to reading once the meaning batch runs dry, even mid-session', () => {
        const readingRetry = makeVocabProgress({
            vocabId: 'reading-retry-item',
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: null },
            // Explicit (not spread from the shared DEFAULT_VOCABULARY_PROGRESS.meaning
            // object) - other test files mutate that shared nested object, which made
            // this test flaky depending on run order/suite composition.
            meaning: { ...DEFAULT_VOCABULARY_PROGRESS.meaning, dueDate: null },
            needsRetry: { reading: true },
        });
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([readingRetry]),
            settings: makeSettings(),
            currentQuizItem: { vocab: readingRetry, quizType: 'meaning', quizMode: 'base' },
        };

        const result = selectNextView(state, false, now);
        expect(result.queueItem?.quizType).toBe('reading');
    });

    it('shouldShowIntro is true when the loaded vocab has no matching queue entry yet', () => {
        const vocab = makeVocab('new-vocab');
        const state: QuizState = { ...initialState, progress: makeProgress([]), settings: makeSettings(), currentVocab: vocab };
        const result = selectNextView(state, false, now);
        expect(result.shouldShowIntro).toBe(true);
    });

    it('shouldShowIntro is true when the queue entry exists but has not been introduced yet', () => {
        const vocab = makeVocab('v1');
        const notIntroduced = makeVocabProgress({ vocabId: 'v1', introductionAt: null });
        const state: QuizState = { ...initialState, progress: makeProgress([notIntroduced]), settings: makeSettings(), currentVocab: vocab };
        const result = selectNextView(state, false, now);
        expect(result.shouldShowIntro).toBe(true);
    });

    it('shouldShowIntro is false once the vocab has been introduced', () => {
        const vocab = makeVocab('v1');
        const introduced = makeVocabProgress({ vocabId: 'v1', introductionAt: past });
        const state: QuizState = { ...initialState, progress: makeProgress([introduced]), settings: makeSettings(), currentVocab: vocab };
        const result = selectNextView(state, false, now);
        expect(result.shouldShowIntro).toBe(false);
    });
});

describe('selectCurrentProgress', () => {
    it('returns null without a current vocab', () => {
        expect(selectCurrentProgress({ currentVocab: null, progress: makeProgress([]) })).toBeNull();
    });

    it('finds the matching queue entry for the current vocab', () => {
        const item = makeVocabProgress({ vocabId: 'v1' });
        const result = selectCurrentProgress({ currentVocab: makeVocab('v1'), progress: makeProgress([item]) });
        expect(result).toBe(item);
    });
});

describe('selectCurrentSentence', () => {
    const sentences: Sentence[] = [
        { id: 's1', original: '日本語', en: [{ id: 'e1', text: 'Japanese' }], vocabIds: ['v1'] },
        { id: 's2', original: '日本人', en: [{ id: 'e2', text: 'Japanese person' }], vocabIds: ['v1'] },
    ];

    it('returns null without a selected sentence id', () => {
        expect(selectCurrentSentence({ currentSentences: sentences, currentSentenceId: null })).toBeNull();
    });

    it('finds the sentence matching currentSentenceId', () => {
        const result = selectCurrentSentence({ currentSentences: sentences, currentSentenceId: 's2' });
        expect(result?.original).toBe('日本人');
    });
});

describe('selectSessionStats', () => {
    const settings = makeSettings();

    // Build vocab with fully explicit reading/meaning entries. Note: DEFAULT_VOCABULARY_PROGRESS
    // holds SHARED nested reading/meaning objects, and other test files mutate them - so these
    // helpers must not lean on those defaults for the very fields under test (dueDate).
    function entry(dueDate: Date | null) {
        return { memoryStrength: 1, interval: 0, difficulty: 0.3, lastReviewedAt: null, dueDate, history: [] };
    }

    function vocab(
        id: string,
        opts: { readingDue?: Date | null; meaningDue?: Date | null; needsRetry?: VocabProgress['needsRetry']; totalReviews?: number } = {}
    ): VocabProgress {
        return {
            ...DEFAULT_VOCABULARY_PROGRESS,
            vocabId: id,
            stage: 'learning',
            introductionAt: past,
            totalReviews: opts.totalReviews ?? 1,
            reading: entry(opts.readingDue ?? null),
            meaning: entry(opts.meaningDue ?? null),
            needsRetry: opts.needsRetry,
        };
    }

    function stateWith(queue: VocabProgress[], committed: TaskKey[]) {
        return { progress: makeProgress(queue), settings, session: { committed } };
    }

    it('returns zeros without progress', () => {
        const stats = selectSessionStats({ progress: null, settings, session: null }, false, now);
        expect(stats).toEqual({ done: 0, total: 0, retriesPending: 0, waiting: 0, moreNew: false });
    });

    it('total is the committed set size; done counts committed tasks that are no longer actionable', () => {
        const stillDue = vocab('a', { readingDue: past });
        // 'b' was answered this session - its reading due date has been pushed to the future.
        const answered = vocab('b', { readingDue: future });
        const state = stateWith([stillDue, answered], [taskKey('a', 'reading'), taskKey('b', 'reading')]);

        const stats = selectSessionStats(state, false, now);
        expect(stats.total).toBe(2);
        expect(stats.done).toBe(1);
        expect(stats.retriesPending).toBe(0);
    });

    it('counts a pending retry without shrinking the total (the core regression)', () => {
        // A wrong answer pushes the due date ~12h out (so the item is no longer "due")
        // but sets needsRetry - the task is still actionable and must not leave the total.
        const retryItem = vocab('a', { readingDue: future, needsRetry: { reading: true } });
        const state = stateWith([retryItem], [taskKey('a', 'reading')]);

        const stats = selectSessionStats(state, false, now);
        expect(stats.total).toBe(1);
        expect(stats.done).toBe(0);
        expect(stats.retriesPending).toBe(1);
    });

    it('reviews that came due after the session started are counted as waiting, not in the total', () => {
        const committedItem = vocab('a', { readingDue: past });
        const newlyDue = vocab('b', { readingDue: past });
        const state = stateWith([committedItem, newlyDue], [taskKey('a', 'reading')]);

        const stats = selectSessionStats(state, false, now);
        expect(stats.total).toBe(1);
        expect(stats.waiting).toBe(1);
    });

    it('moreNew mirrors hasMoreLearnable (the "+" in "n+ vocab waiting")', () => {
        const state = stateWith([], []);
        expect(selectSessionStats(state, true, now).moreNew).toBe(true);
        expect(selectSessionStats(state, false, now).moreNew).toBe(false);
    });

    it('with no active session, total is 0 and live due items surface as waiting', () => {
        const state = { progress: makeProgress([vocab('a', { readingDue: past })]), settings, session: null };
        const stats = selectSessionStats(state, false, now);
        expect(stats.total).toBe(0);
        expect(stats.waiting).toBe(1);
    });

    it('a committed meaning staggered away by its own reading answer still counts toward total/done (matches the Main hub preview)', () => {
        // Both reading and meaning are due together at session start, so both are
        // committed - session.committed is unfiltered, matching selectNextSessionPreview
        // and what selectNextView actually serves. A prior version dropped the meaning
        // key here, which desynced this counter (3) from the Main hub preview (6) and
        // mislabeled the still-committed meaning task as "waiting after this session"
        // when it was actually part of this one.
        const rawCommitted = [taskKey('a', 'reading'), taskKey('a', 'meaning')];

        // Simulate having answered the reading: it's no longer due, and its
        // meaning got staggered forward (the real applyAnswer behavior).
        const answered = vocab('a', { readingDue: future, meaningDue: future });
        const state = { progress: makeProgress([answered]), settings, session: { committed: rawCommitted } };

        const stats = selectSessionStats(state, false, now);
        expect(stats.total).toBe(2); // both tasks were committed
        expect(stats.done).toBe(2); // the staggered-away meaning resolved without a separate answer
    });

    it('a committed meaning left genuinely due (reading answered wrong, no stagger) stays actionable, not "done" or "waiting"', () => {
        const rawCommitted = [taskKey('a', 'reading'), taskKey('a', 'meaning')];
        // Reading retry pending (wrong answer): no stagger fires, meaning stays due.
        const stillDue = vocab('a', { readingDue: past, meaningDue: past, needsRetry: { reading: true } });
        const state = { progress: makeProgress([stillDue]), settings, session: { committed: rawCommitted } };

        const stats = selectSessionStats(state, false, now);
        expect(stats.total).toBe(2);
        expect(stats.done).toBe(0);
        expect(stats.waiting).toBe(0); // committed, not a mid-session arrival
    });
});

describe('selectNextSessionPreview', () => {
    const settings = makeSettings();

    // Explicit reading/meaning entries, same rationale as selectSessionStats's local
    // helpers above: DEFAULT_VOCABULARY_PROGRESS's nested entries are shared/mutated
    // elsewhere, so dueDate must never be left to fall through to that default.
    function entry(dueDate: Date | null) {
        return { memoryStrength: 1, interval: 0, difficulty: 0.3, lastReviewedAt: null, dueDate, history: [] };
    }

    function vocab(
        id: string,
        opts: {
            stage?: VocabProgress['stage'];
            totalReviews?: number;
            readingDue?: Date | null;
            meaningDue?: Date | null;
            needsRetry?: VocabProgress['needsRetry'];
        } = {}
    ): VocabProgress {
        return {
            ...DEFAULT_VOCABULARY_PROGRESS,
            vocabId: id,
            stage: opts.stage ?? 'learning',
            introductionAt: past,
            totalReviews: opts.totalReviews ?? 1,
            reading: entry(opts.readingDue ?? null),
            meaning: entry(opts.meaningDue ?? null),
            needsRetry: opts.needsRetry,
        };
    }

    it('returns all zeros without progress', () => {
        expect(selectNextSessionPreview({ progress: null, settings }, now)).toEqual({ review: 0, new: 0, retries: 0, remaining: 0 });
    });

    it('buckets a due reading as review', () => {
        const state = { progress: makeProgress([vocab('a', { readingDue: past })]), settings };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 1, new: 0, retries: 0, remaining: 0 });
    });

    it('buckets a due meaning as review', () => {
        const state = { progress: makeProgress([vocab('a', { meaningDue: past })]), settings };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 1, new: 0, retries: 0, remaining: 0 });
    });

    it('buckets an unreviewed queued item as new, regardless of due dates', () => {
        const state = { progress: makeProgress([vocab('a', { totalReviews: 0 })]), settings };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 1, retries: 0, remaining: 0 });
    });

    it('buckets a pending reading retry as retries', () => {
        const state = { progress: makeProgress([vocab('a', { needsRetry: { reading: true } })]), settings };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 0, retries: 1, remaining: 0 });
    });

    it('buckets a pending meaning retry as retries', () => {
        const state = { progress: makeProgress([vocab('a', { needsRetry: { meaning: true } })]), settings };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 0, retries: 1, remaining: 0 });
    });

    it('retries take precedence over new and review for the same vocab', () => {
        // Never reviewed AND has a due date AND flagged for retry - retry wins.
        const state = {
            progress: makeProgress([vocab('a', { totalReviews: 0, readingDue: past, needsRetry: { reading: true } })]),
            settings,
        };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 0, retries: 1, remaining: 0 });
    });

    it('excludes graduated vocab entirely', () => {
        const state = {
            progress: makeProgress([vocab('a', { stage: 'graduated', readingDue: past, needsRetry: { reading: true } })]),
            settings,
        };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 0, retries: 0, remaining: 0 });
    });

    it('ignores a due meaning when meaning quizzes are disabled', () => {
        const disabled = makeSettings({ enableMeaningQuiz: false });
        const state = { progress: makeProgress([vocab('a', { meaningDue: past })]), settings: disabled };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 0, retries: 0, remaining: 0 });
    });

    it('does not count an item with no due date and no retry in any bucket', () => {
        const state = { progress: makeProgress([vocab('a', { readingDue: future, meaningDue: future })]), settings };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 0, new: 0, retries: 0, remaining: 0 });
    });

    it('sums mixed buckets across multiple vocab', () => {
        const state = {
            progress: makeProgress([
                vocab('a', { readingDue: past }),
                vocab('b', { totalReviews: 0 }),
                vocab('c', { needsRetry: { meaning: true } }),
                vocab('d', { readingDue: future }),
            ]),
            settings,
        };
        expect(selectNextSessionPreview(state, now)).toEqual({ review: 1, new: 1, retries: 1, remaining: 0 });
    });
});

describe('capSessionCommit', () => {
    function keys(type: 'reading' | 'meaning', n: number, offset = 0): TaskKey[] {
        return Array.from({ length: n }, (_, i) => taskKey(`${type}-${i + offset}`, type));
    }

    it('returns the snapshot untouched when it already fits under the cap', () => {
        const input = [...keys('reading', 5), ...keys('meaning', 5)];
        expect(capSessionCommit(input, 200)).toBe(input);
    });

    it('splits the cap evenly across quiz types instead of taking a prefix', () => {
        // Selection clears every reading before any meaning, so a plain prefix of this
        // snapshot would be 100% readings and starve the meaning backlog permanently.
        const input = [...keys('reading', 300), ...keys('meaning', 300)];
        const capped = capSessionCommit(input, 200);

        expect(capped).toHaveLength(200);
        expect(capped.filter(k => k.endsWith(':reading'))).toHaveLength(100);
        expect(capped.filter(k => k.endsWith(':meaning'))).toHaveLength(100);
    });

    it('spills an under-filled type’s unused share to the other types', () => {
        // Only 20 meanings due: the session should still commit a full 200 rather than
        // stopping at the 20 + 100 an inflexible per-type quota would allow.
        const input = [...keys('reading', 300), ...keys('meaning', 20)];
        const capped = capSessionCommit(input, 200);

        expect(capped).toHaveLength(200);
        expect(capped.filter(k => k.endsWith(':meaning'))).toHaveLength(20);
        expect(capped.filter(k => k.endsWith(':reading'))).toHaveLength(180);
    });

    it('fills the cap exactly when the split leaves an integer-division remainder', () => {
        const input = [...keys('reading', 300), ...keys('meaning', 300)];
        expect(capSessionCommit(input, 201)).toHaveLength(201);
    });

    it('preserves the input order of whatever it keeps', () => {
        const input = [...keys('reading', 10), ...keys('meaning', 10)];
        const capped = capSessionCommit(input, 6);
        const expectedOrder = input.filter(k => capped.includes(k));
        expect(capped).toEqual(expectedOrder);
    });

    it('never exceeds the cap when a single type holds every task', () => {
        const capped = capSessionCommit(keys('reading', 500), 200);
        expect(capped).toHaveLength(200);
    });
});

describe('selectNextView session cap', () => {
    const settings = makeSettings();

    // nextReviewAt as well as reading.dueDate: the former drives computeSessionState's
    // review/waiting call, the latter drives isReadingActionable and queue selection.
    function dueReading(id: string): VocabProgress {
        return makeVocabProgress({
            vocabId: id,
            nextReviewAt: past,
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: past },
        });
    }

    it('only serves tasks in the session’s committed set', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([dueReading('a'), dueReading('b')]),
            settings,
            session: { committed: [taskKey('b', 'reading')] },
        };

        // 'a' is due too, but was left out by the cap, so it must not be served.
        expect(selectNextView(state, false, now).queueItem?.vocab?.vocabId).toBe('b');
    });

    it('reports session-complete once the committed set is cleared but work is still due', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([dueReading('a')]),
            settings,
            // 'a' is due and uncommitted; the session committed something already answered.
            session: { committed: [taskKey('answered', 'reading')] },
        };

        const result = selectNextView(state, false, now);
        expect(result.sessionState).toBe('session-complete');
        expect(result.queueItem).toBeNull();
    });

    it('does not report session-complete while committed work remains', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([dueReading('a')]),
            settings,
            session: { committed: [taskKey('a', 'reading')] },
        };

        expect(selectNextView(state, false, now).sessionState).toBe('review');
    });

    it('does not report session-complete when nothing is left outside the committed set', () => {
        const notDue = makeVocabProgress({
            vocabId: 'a',
            reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, dueDate: future },
        });
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([notDue]),
            settings,
            session: { committed: [taskKey('a', 'reading')] },
        };

        // Nothing uncommitted is actionable, so the ordinary waiting/exhausted path stands.
        expect(selectNextView(state, false, now).sessionState).not.toBe('session-complete');
    });

    it('leaves selection unbounded when no session is active', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([dueReading('a')]),
            settings,
            session: null,
        };

        expect(selectNextView(state, false, now).queueItem?.vocab?.vocabId).toBe('a');
    });
});

describe('session cap with three quiz types', () => {
    function keysOf(type: 'reading' | 'meaning' | 'production', n: number): TaskKey[] {
        return Array.from({ length: n }, (_, i) => taskKey(`${type}-${i}`, type));
    }

    it('splits the cap into thirds once production is in play', () => {
        const input = [...keysOf('reading', 300), ...keysOf('meaning', 300), ...keysOf('production', 300)];
        const capped = capSessionCommit(input, 201);

        expect(capped).toHaveLength(201);
        expect(capped.filter(k => k.endsWith(':reading'))).toHaveLength(67);
        expect(capped.filter(k => k.endsWith(':meaning'))).toHaveLength(67);
        expect(capped.filter(k => k.endsWith(':production'))).toHaveLength(67);
    });

    it('still fills the cap when production has barely any work yet', () => {
        // The expected shape early in the rollout: production activates lazily, so its
        // pool is tiny at first and must not shrink the session to a third of the cap.
        const input = [...keysOf('reading', 300), ...keysOf('meaning', 300), ...keysOf('production', 5)];
        const capped = capSessionCommit(input, 210);

        expect(capped).toHaveLength(210);
        expect(capped.filter(k => k.endsWith(':production'))).toHaveLength(5);
    });
});

describe('production is actually servable alongside a due reading', () => {
    const settings = makeSettings();

    it('commits production for a word whose reading is due too, and serves it', () => {
        // The end-to-end shape of the bug reported from staging: all three directions
        // due at once must not collapse to a reading-only session.
        const entry = (due: Date | null) => ({ ...DEFAULT_VOCABULARY_PROGRESS.reading, memoryStrength: 200, dueDate: due });
        const word: VocabProgress = makeVocabProgress({
            vocabId: 'a',
            nextReviewAt: past,
            reading: entry(past),
            meaning: entry(past),
            production: entry(past),
        });

        const actionable = collectActionableTaskKeys([word], settings, now);
        expect(actionable).toContain(taskKey('a', 'production'));

        // Committed is unfiltered now, so production survives into the served set.
        const committed = capSessionCommit(actionable);
        expect(committed).toContain(taskKey('a', 'production'));

        // With reading and meaning already cleared, production is what gets served.
        const cleared: VocabProgress = { ...word, reading: entry(future), meaning: entry(future) };
        const state: QuizState = {
            ...initialState,
            progress: makeProgress([cleared]),
            settings,
            session: { committed },
        };
        const view = selectNextView(state, false, now);
        expect(view.queueItem?.quizType).toBe('production');
    });
});

describe('selectNextSessionPreview counts cards, including production', () => {
    const settings = makeSettings();

    function entry(due: Date | null) {
        return { ...DEFAULT_VOCABULARY_PROGRESS.reading, memoryStrength: 200, dueDate: due };
    }

    it('does not report "caught up" when only production is due', () => {
        // The reported bug: the preview listed reading and meaning by hand and was
        // never extended to production, so the Main hub card said the user was caught
        // up while the session had a full queue of production cards waiting.
        const word = makeVocabProgress({
            vocabId: 'a',
            reading: entry(future),
            meaning: entry(future),
            production: entry(past),
        });

        const preview = selectNextSessionPreview({ progress: makeProgress([word]), settings }, now);
        expect(preview.review).toBe(1);
    });

    it('counts one card per due direction, not one per word', () => {
        const word = makeVocabProgress({
            vocabId: 'a',
            reading: entry(past),
            meaning: entry(past),
            production: entry(past),
        });

        const preview = selectNextSessionPreview({ progress: makeProgress([word]), settings }, now);
        expect(preview.review).toBe(3);
    });

    it('caps the counts at the session cap and reports the overflow separately', () => {
        const cap = CONSTANTS.srs.sessionQuizCap;
        // 150 words x 2 due directions = 300 cards, which is 100 past the cap.
        const queue = Array.from({ length: 150 }, (_, i) =>
            makeVocabProgress({ vocabId: `v${i}`, reading: entry(past), meaning: entry(past), production: entry(future) })
        );

        const preview = selectNextSessionPreview({ progress: makeProgress(queue), settings }, now);

        expect(preview.review + preview.retries).toBe(cap);
        expect(preview.remaining).toBe(300 - cap);
    });

    it('reports no overflow when everything due fits in one session', () => {
        const queue = Array.from({ length: 5 }, (_, i) =>
            makeVocabProgress({ vocabId: `v${i}`, reading: entry(past) })
        );

        expect(selectNextSessionPreview({ progress: makeProgress(queue), settings }, now).remaining).toBe(0);
    });

    it('matches what the session actually commits to', () => {
        // The preview and the session derive from the same two functions, so they
        // cannot drift: this is the property that guarantees the card is honest.
        const queue = Array.from({ length: 150 }, (_, i) =>
            makeVocabProgress({ vocabId: `v${i}`, reading: entry(past), meaning: entry(past) })
        );

        const preview = selectNextSessionPreview({ progress: makeProgress(queue), settings }, now);
        const committed = capSessionCommit(collectActionableTaskKeys(queue, settings, now));

        expect(preview.review + preview.new + preview.retries).toBe(committed.length);
    });
});
