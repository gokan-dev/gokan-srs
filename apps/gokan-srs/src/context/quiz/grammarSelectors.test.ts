import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
    selectNextGrammarView,
    computeBlankPlan,
    gradeGrammarAnswers,
    selectCurrentGrammarProgress,
    selectNextGrammarSessionPreview,
    collectActionableGrammarIds,
    selectGrammarSessionStats,
    summariseVocabGains,
    selectChapterEndFocusIds,
    selectNewlyCompletedChapterIds,
} from './grammarSelectors';
import type { QuizState } from './quizReducer';
import type { UserProgress } from '../../models/user.model';
import type { GrammarChapter, GrammarContrastIndex, GrammarPoint, GrammarProgress } from '../../models/grammar.model';
import { DEFAULT_GRAMMAR_PROGRESS } from '../../models/grammar.model';
import type { VocabProgress } from '../../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../../models/vocabulary.model';
import type { Vocabulary } from '../../models/vocabulary.model';
import { VocabularyService } from '../../services/vocabulary.service';
import { GrammarService } from '../../services/grammar.service';

const now = new Date('2026-06-10T00:00:00Z');
const past = new Date('2026-06-01T00:00:00Z');
const future = new Date('2026-07-01T00:00:00Z');

function makeProgress(overrides: Partial<UserProgress> = {}): UserProgress {
    return {
        kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set() },
        learningQueue: [],
        grammarQueue: [],
        completedChapters: [],
        stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
        dailyOverride: false,
        adaptive: { level: 1.0, history: [] },
        ...overrides,
    };
}

function makeGrammarProgress(overrides: Partial<GrammarProgress> = {}): GrammarProgress {
    return { ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'n5-001', ...overrides };
}

/**
 * Default fixture has `patternWordIndices: []` (pattern NOT located) so every
 * existing vocab-fallback test below keeps exercising Passes 2-4 unchanged -
 * Pass 1 is only reached with a fixture that actually populates it (see the
 * dedicated "PRIMARY: pattern-word blanking" describe block).
 */
function makeGrammarPoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n5-001',
        title: 'A が いちばん～',
        jlptLevel: 5,
        shortExplanation: 'superlative',
        longExplanation: 'superlative, in detail',
        formation: 'Noun + が + いちばん',
        examples: [{
            jp: 'この中で、寿司が一番好きです。',
            romaji: 'kono naka de sushi ga ichiban suki desu',
            en: 'Of all these, I like sushi the most.',
            patternWordIndices: [],
            words: [
                { surface: 'この', vocabId: null },
                { surface: '中', vocabId: 'v-naka', reading: 'なか' },
                { surface: 'で', vocabId: null },
                { surface: '、', vocabId: null },
                { surface: '寿司', vocabId: 'v-sushi', reading: 'すし' },
                { surface: 'が', vocabId: null },
                { surface: '一番', vocabId: 'v-ichiban', reading: 'いちばん' },
                { surface: '好き', vocabId: 'v-suki', reading: 'すき' },
                { surface: 'です', vocabId: null },
                { surface: '。', vocabId: null },
            ],
        }],
        ...overrides,
    };
}

function makeVocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return { ...DEFAULT_VOCABULARY_PROGRESS, ...overrides };
}

function makeVocab(overrides: Partial<Vocabulary> = {}): Vocabulary {
    return {
        id: 'v-x',
        writtenForm: { kanji: '', alternatives: [], containedKanji: [] },
        reading: { primary: '', alternatives: [] },
        frequency: { kanjiRank: 500 },
        progression: { kklcStep: 0 },
        senses: [],
        ...overrides,
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('selectNextGrammarView', () => {
    it('prioritizes grammarIntroCandidates for queueItem over the due pool', () => {
        const point = makeGrammarPoint();
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [makeGrammarProgress({ entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } })] }),
            grammarIntroCandidates: [point],
            currentGrammarPoint: null,
        };

        const result = selectNextGrammarView(state, false, now);
        expect(result.queueItem).toEqual({ grammarId: point.id });
    });

    it('sessionState is "review" when a queued grammar point is due', () => {
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [makeGrammarProgress({ entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } })] }),
            grammarIntroCandidates: [],
            currentGrammarPoint: null,
        };

        expect(selectNextGrammarView(state, false, now).sessionState).toBe('review');
    });

    it('sessionState is "learn" when nothing is due but more grammar can be learned', () => {
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [] }),
            grammarIntroCandidates: [],
            currentGrammarPoint: null,
        };

        expect(selectNextGrammarView(state, true, now).sessionState).toBe('learn');
    });

    it('sessionState is "waiting" when learning items exist but none are due and nothing more to learn', () => {
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [makeGrammarProgress({ entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: future } })] }),
            grammarIntroCandidates: [],
            currentGrammarPoint: null,
        };

        const result = selectNextGrammarView(state, false, now);
        expect(result.sessionState).toBe('waiting');
        expect(result.nextReviewAt).toEqual(future);
    });

    it('sessionState is "exhausted" with an empty queue and nothing learnable', () => {
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [] }),
            grammarIntroCandidates: [],
            currentGrammarPoint: null,
        };

        expect(selectNextGrammarView(state, false, now).sessionState).toBe('exhausted');
    });

    it('shouldShowIntro is true when the loaded point has no matching queue entry yet', () => {
        const point = makeGrammarPoint();
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [] }),
            grammarIntroCandidates: [],
            currentGrammarPoint: point,
        };

        expect(selectNextGrammarView(state, false, now).shouldShowIntro).toBe(true);
    });

    it('shouldShowIntro is false once the point has been introduced', () => {
        const point = makeGrammarPoint();
        const state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'> = {
            progress: makeProgress({ grammarQueue: [makeGrammarProgress({ grammarId: point.id, introductionAt: past })] }),
            grammarIntroCandidates: [],
            currentGrammarPoint: point,
        };

        expect(selectNextGrammarView(state, false, now).shouldShowIntro).toBe(false);
    });
});

describe('computeBlankPlan', () => {
    it('blanks only words resolved to a vocab the user already knows (introduced)', async () => {
        const point = makeGrammarPoint();
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        // Only the word matching vocabId 'v-sushi' (index 4, "寿司") is known.
        expect(plan.blankWordIndices).toEqual([4]);
        expect(plan.readOnly).toBe(false);
    });

    it('accept list always includes at least the surface and embedded reading, even if the vocab fetch fails', async () => {
        vi.spyOn(VocabularyService, 'loadVocab').mockRejectedValue(new Error('network error'));
        const point = makeGrammarPoint();
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        expect(plan.acceptLists[0]).toEqual(expect.arrayContaining(['寿司', 'すし']));
    });

    it('extends the accept list with vocab writtenForm/reading alternatives and merged-vocab readings', async () => {
        vi.spyOn(VocabularyService, 'loadVocab').mockResolvedValue(makeVocab({
            id: 'v-sushi',
            writtenForm: { kanji: '寿司', alternatives: ['鮨', '鮓'], containedKanji: [] },
            reading: { primary: 'すし', alternatives: ['寿し'] },
            mergedVocabs: [{ id: 'v-alt', isBase: false, originalPrimaryReading: '壽司', originalGlosses: [] }],
        }));

        const point = makeGrammarPoint();
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        expect(new Set(plan.acceptLists[0])).toEqual(new Set(['寿司', 'すし', '鮨', '鮓', '寿し', '壽司']));
    });

    it('resolves a hint gloss from the vocab senses', async () => {
        vi.spyOn(VocabularyService, 'loadVocab').mockResolvedValue(makeVocab({
            id: 'v-sushi',
            senses: [{ pos: [], misc: { rawTags: [] }, glosses: ['sushi'], related: { compounds: [] } }],
        }));

        const point = makeGrammarPoint();
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        expect(plan.glosses[0]).toBe('sushi');
    });

    it('prefers a different example containing a known word over blanking every word in an example with none known (item 5.1)', async () => {
        const point = makeGrammarPoint({
            examples: [
                {
                    jp: '中が好きです。', romaji: 'naka ga suki desu', en: 'I like the inside.', patternWordIndices: [],
                    words: [{ surface: '中', vocabId: 'v-naka', reading: 'なか' }, { surface: '好き', vocabId: 'v-suki', reading: 'すき' }],
                },
                {
                    jp: '寿司が好きです。', romaji: 'sushi ga suki desu', en: 'I like sushi.', patternWordIndices: [],
                    words: [{ surface: '寿司', vocabId: 'v-sushi', reading: 'すし' }, { surface: '好き', vocabId: 'v-suki', reading: 'すき' }],
                },
            ],
        });
        // Only 'v-sushi' (in example index 1) is known - example index 0 has candidates but none known.
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        expect(plan.exampleIndex).toBe(1);
        expect(plan.blankWordIndices).toEqual([0]);
        expect(plan.readOnly).toBe(false);
    });

    it('falls back to a single most-frequent-word blank when no example has a known word (item 5.2)', async () => {
        vi.spyOn(VocabularyService, 'loadVocab').mockImplementation(async (id: string) => {
            const ranks: Record<string, number> = { 'v-naka': 5000, 'v-sushi': 800, 'v-ichiban': 3000, 'v-suki': 1500 };
            return makeVocab({ id, frequency: { kanjiRank: ranks[id] ?? 999999 } });
        });

        const point = makeGrammarPoint();
        const progress = makeProgress({ learningQueue: [] });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        // 'v-sushi' (index 4) has the lowest (most frequent) kanjiRank among the candidates.
        expect(plan.blankWordIndices).toEqual([4]);
        expect(plan.readOnly).toBe(false);
    });

    it('a vocab entry that exists but was never introduced does not count as known, so the single-blank fallback still applies', async () => {
        vi.spyOn(VocabularyService, 'loadVocab').mockResolvedValue(makeVocab());
        const point = makeGrammarPoint();
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: null })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        expect(plan.blankWordIndices.length).toBe(1);
    });

    it('skips an example with zero blankable words in favor of another example in the same point (item 6)', async () => {
        const point = makeGrammarPoint({
            examples: [
                { jp: 'どれでもいいですか？', romaji: 'dore demo ii desu ka', en: 'Is any of them fine?', patternWordIndices: [], words: [{ surface: 'どれでもいいですか', vocabId: null }] },
                {
                    jp: '寿司が好きです。', romaji: 'sushi ga suki desu', en: 'I like sushi.', patternWordIndices: [],
                    words: [{ surface: '寿司', vocabId: 'v-sushi', reading: 'すし' }],
                },
            ],
        });
        const progress = makeProgress({
            learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
        });

        const plan = (await computeBlankPlan(point, progress, 0))!;
        expect(plan.exampleIndex).toBe(1);
        expect(plan.blankWordIndices).toEqual([0]);
        expect(plan.readOnly).toBe(false);
    });

    it('returns a read-only plan with no blanks when literally no example has a blankable word (item 6)', async () => {
        const point = makeGrammarPoint({
            examples: [
                { jp: 'どれでもいいですか？', romaji: 'dore demo ii desu ka', en: 'Is any of them fine?', patternWordIndices: [], words: [{ surface: 'どれでもいいですか', vocabId: null }] },
                { jp: 'いいですか？', romaji: 'ii desu ka', en: 'Is that fine?', patternWordIndices: [], words: [{ surface: 'いいですか', vocabId: null }] },
            ],
        });

        const plan = (await computeBlankPlan(point, null, 0))!;
        expect(plan.readOnly).toBe(true);
        expect(plan.blankWordIndices).toEqual([]);
        expect(plan.acceptLists).toEqual([]);
    });

    it('returns null when the grammar point has no examples', async () => {
        const point = makeGrammarPoint({ examples: [] });
        expect(await computeBlankPlan(point, null, 0)).toBeNull();
    });

    it('picks a deterministic example index for the same point/reviewCount pair', async () => {
        const point = makeGrammarPoint({
            examples: [
                { jp: 'A', romaji: 'a', en: 'a', patternWordIndices: [], words: [] },
                { jp: 'B', romaji: 'b', en: 'b', patternWordIndices: [], words: [] },
                { jp: 'C', romaji: 'c', en: 'c', patternWordIndices: [], words: [] },
            ],
        });

        const first = await computeBlankPlan(point, null, 3);
        const second = await computeBlankPlan(point, null, 3);
        expect(first).toEqual(second);
    });

    describe('PRIMARY: pattern-word blanking', () => {
        // が (index 5) and 一番 (index 6) are this point's precomputed pattern markers.
        function makePatternPoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
            const point = makeGrammarPoint(overrides);
            point.examples[0].patternWordIndices = [5, 6];
            return point;
        }

        it('blanks the pattern markers unconditionally, even with zero known vocab', async () => {
            const point = makePatternPoint();
            const plan = (await computeBlankPlan(point, makeProgress({ learningQueue: [] }), 0))!;
            // One input covering both marker tokens - see blankSpansOf.
            expect(plan.blankWordIndices).toEqual([5]);
            expect(plan.blankWordSpans).toEqual([[5, 6]]);
            expect(plan.readOnly).toBe(false);
        });

        it('blanks the pattern markers even with a null progress (unauthenticated/loading state)', async () => {
            const point = makePatternPoint();
            const plan = (await computeBlankPlan(point, null, 0))!;
            expect(plan.blankWordSpans).toEqual([[5, 6]]);
        });

        it('takes priority over vocab-only blanking: known vocab does NOT replace the pattern as the primary target', async () => {
            const point = makePatternPoint();
            // 'v-sushi' (index 4) is known - under the OLD vocab-primary behavior this
            // alone would have been the entire blank set. It must now only be a
            // SECONDARY addition alongside the pattern, never a replacement for it.
            const progress = makeProgress({
                learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
            });

            const plan = (await computeBlankPlan(point, progress, 0))!;
            expect(plan.blankWordSpans.flat()).toContain(5);
            expect(plan.blankWordSpans.flat()).toContain(6);
        });

        it('layers known vocab on top of the pattern as secondary reinforcement, sorted by position', async () => {
            const point = makePatternPoint();
            const progress = makeProgress({
                learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
            });

            const plan = (await computeBlankPlan(point, progress, 0))!;
            // 寿司 (known vocab) is its own input; が + 一番 (the pattern) are one.
            expect(plan.blankWordSpans).toEqual([[4], [5, 6]]);
            // Classification is what lets grading credit the pattern vs the vocab
            // separately: 寿司 is the vocab reinforcement blank, が/一番 are the pattern.
            expect(plan.isPatternBlank).toEqual([false, true]);
        });

        it('does not double-count a pattern word that also resolves to a known vocab id', async () => {
            const point = makePatternPoint();
            // 一番 (index 6, part of the pattern) is ALSO a known vocab entry.
            const progress = makeProgress({
                learningQueue: [makeVocabProgress({ vocabId: 'v-ichiban', introductionAt: past })],
            });

            const plan = (await computeBlankPlan(point, progress, 0))!;
            expect(plan.blankWordSpans).toEqual([[5, 6]]); // no duplicate index for 一番
        });

        it('leaves unknown vocab pre-filled as context, not blanked, alongside the pattern', async () => {
            const point = makePatternPoint();
            const plan = (await computeBlankPlan(point, makeProgress({ learningQueue: [] }), 0))!;
            expect(plan.blankWordSpans.flat()).not.toContain(4); // 寿司 - not known, stays literal
            expect(plan.blankWordSpans.flat()).not.toContain(7); // 好き - not known, stays literal
        });

        it('grades a merged span on the concatenation of its words, not per token', async () => {
            // The bug this fixes: どこ/に/も rendered as three inputs, and there is
            // no way to know which box wants which token. Worse, canSubmitGrammar
            // needs EVERY input filled, so typing どこにも into the first box and
            // leaving the others empty left the learner unable to submit at all.
            const point = makePatternPoint();
            const plan = (await computeBlankPlan(point, makeProgress({ learningQueue: [] }), 0))!;
            const example = point.examples[plan.exampleIndex];
            const joined = plan.blankWordSpans[0].map(i => example.words[i].surface).join('');

            expect(plan.acceptLists).toHaveLength(1);
            expect(plan.acceptLists[0]).toContain(joined);
        });

        it('carries the example the blanks were computed against', async () => {
            // The variant-rotation bug: computeBlankPlan indexes into the ROTATED
            // realization's examples while the orchestration dispatches the
            // canonical point, so a card rendering point.examples[exampleIndex]
            // applied one sentence's blank indices to a different sentence -
            // blanking the wrong words, hiding others, and (when the realization
            // had more blanks than the canonical had words) leaving an answer slot
            // that could never be filled, which locked Submit forever.
            const point = makePatternPoint();
            const plan = (await computeBlankPlan(point, makeProgress({ learningQueue: [] }), 0))!;

            expect(plan.example).toBeDefined();
            // Every blanked index must exist in the example the plan carries.
            for (const wordIndex of plan.blankWordSpans.flat()) {
                expect(plan.example!.words[wordIndex]).toBeDefined();
            }
            expect(plan.blankWordSpans.flat().length).toBeLessThanOrEqual(plan.example!.words.length);
        });

        it('never merges vocab blanks, with each other or into a pattern run', async () => {
            // Adjacent vocab blanks are separate words that happen to sit side by
            // side, and each is graded on its own - merging them would ask for two
            // words in one box and credit neither.
            const point = makeGrammarPoint();
            point.examples[0].patternWordIndices = [6];
            const progress = makeProgress({
                learningQueue: [
                    makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past }),
                    makeVocabProgress({ vocabId: 'v-ichiban', introductionAt: past }),
                ],
            });

            const plan = (await computeBlankPlan(point, progress, 0))!;
            expect(plan.blankWordSpans.every(span => span.length === 1)).toBe(true);
        });

        it('falls back to vocab-based blanking when the pattern is not located in any example of the point', async () => {
            // Default fixture (no override) has patternWordIndices: [] - Pass 1 must
            // be skipped entirely, falling through to the existing vocab fallback.
            const point = makeGrammarPoint();
            const progress = makeProgress({
                learningQueue: [makeVocabProgress({ vocabId: 'v-sushi', introductionAt: past })],
            });

            const plan = (await computeBlankPlan(point, progress, 0))!;
            expect(plan.blankWordIndices).toEqual([4]);
            // No pattern located, so the vocab blank is not classified as pattern -
            // grading falls back to worst-of-all at full strength.
            expect(plan.isPatternBlank).toEqual([false]);
        });
    });
});

describe('wrong conjugation of the right verb', () => {
    // The sentence needs 思っ (te-form stem); 思う/おもう are the dictionary forms.
    // They used to sit in the ideal accept-list, so answering the dictionary form
    // scored full marks even though the conjugation is much of what is being tested.
    const inflectedPlan = {
        acceptLists: [['思っ', 'おもっ']],
        acceptListsMinor: [['思う', 'おもう']],
    };

    it('grades the required inflected form as correct', () => {
        expect(gradeGrammarAnswers(inflectedPlan, ['思っ'], [0]).perBlankResults[0]).toBe('correct');
        expect(gradeGrammarAnswers(inflectedPlan, ['おもっ'], [0]).perBlankResults[0]).toBe('correct');
    });

    it('gives partial credit for the right verb in the wrong conjugation', () => {
        expect(gradeGrammarAnswers(inflectedPlan, ['思う'], [0]).perBlankResults[0]).toBe('minor_error');
        expect(gradeGrammarAnswers(inflectedPlan, ['おもう'], [0]).perBlankResults[0]).toBe('minor_error');
    });

    it('still grades an unrelated verb as wrong', () => {
        expect(gradeGrammarAnswers(inflectedPlan, ['たべる'], [0]).perBlankResults[0]).toBe('wrong');
    });

    it('leaves an uninflected word fully correct in any of its writings', () => {
        // No minor tier is built when the occurrence is not inflected, so writing a
        // noun in kana instead of kanji stays correct rather than becoming a near miss.
        const nounPlan = { acceptLists: [['寿司', 'すし']], acceptListsMinor: [[]] };
        expect(gradeGrammarAnswers(nounPlan, ['すし'], [0]).perBlankResults[0]).toBe('correct');
    });
});

describe('gradeGrammarAnswers', () => {
    const blankPlan = { acceptLists: [['すし', '寿司', '鮨', '鮓']] };

    it('grades a kanji-form answer, a variant-spelling answer, and a reading answer all as correct for the same blank', () => {
        expect(gradeGrammarAnswers(blankPlan, ['寿司'], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(blankPlan, ['鮨'], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(blankPlan, ['すし'], [0]).overall).toBe('correct');
    });

    it('grades an unrelated answer as wrong', () => {
        const result = gradeGrammarAnswers(blankPlan, ['ねこ'], [0]);
        expect(result.overall).toBe('wrong');
        expect(result.perBlankResults).toEqual(['wrong']);
    });

    it('a blank with hintLevel >= 2 grades as minor_error regardless of what was typed', () => {
        const result = gradeGrammarAnswers(blankPlan, ['garbage'], [2]);
        expect(result.perBlankResults).toEqual(['minor_error']);
        expect(result.matchedAnswers).toEqual(['すし']);
        expect(result.overall).toBe('minor_error');
    });

    it('an empty blank grades as pass: a deliberate skip, not a wrong guess', () => {
        // Was 'wrong' while Submit required every blank filled, when an empty blank
        // could only mean a broken card. Submitting with blanks left empty is now a
        // supported way to say "I do not know this one" (see canSubmitGrammar), so it
        // grades as the same skip a literally typed "pass" gives, and the accepted
        // form is revealed in the feedback.
        const result = gradeGrammarAnswers(blankPlan, [''], [0]);
        expect(result.perBlankResults[0]).toBe('pass');
        expect(result.overall).toBe('pass');
    });

    it('grades a whitespace-only blank as a skip too', () => {
        expect(gradeGrammarAnswers(blankPlan, ['   '], [0]).perBlankResults[0]).toBe('pass');
    });

    it('still reveals the accepted form for a skipped blank', () => {
        // The point of allowing an empty submit: the learner sees what it should have
        // been, which is what they were reaching for the hint button to get.
        const result = gradeGrammarAnswers(blankPlan, [''], [0]);
        expect(result.matchedAnswers[0]).toBe('すし');
    });

    describe('worst-of precedence: wrong > pass > minor_error > correct', () => {
        const twoBlankPlan = { acceptLists: [['すし'], ['なか']] };

        it('wrong beats a revealed (minor_error) blank', () => {
            const result = gradeGrammarAnswers(twoBlankPlan, ['ねこ', 'anything'], [0, 2]);
            expect(result.perBlankResults[1]).toBe('minor_error');
            expect(result.overall).toBe('wrong');
        });

        it('wrong beats pass', () => {
            // Typing the literal word "pass" grades that blank as 'pass' independently
            // of the hint system (SRSService.analyzeError) - still reachable even
            // though a revealed hint no longer forces 'pass' itself.
            const result = gradeGrammarAnswers(twoBlankPlan, ['ねこ', 'pass'], [0, 0]);
            expect(result.perBlankResults[1]).toBe('pass');
            expect(result.overall).toBe('wrong');
        });

        it('pass beats minor_error', () => {
            const result = gradeGrammarAnswers(twoBlankPlan, ['すしぃ', 'pass'], [0, 0]);
            expect(result.perBlankResults[0]).toBe('minor_error');
            expect(result.perBlankResults[1]).toBe('pass');
            expect(result.overall).toBe('pass');
        });

        it('pass beats correct', () => {
            const result = gradeGrammarAnswers(twoBlankPlan, ['すし', 'pass'], [0, 0]);
            expect(result.perBlankResults[0]).toBe('correct');
            expect(result.overall).toBe('pass');
        });

        it('a revealed (minor_error) blank beats correct', () => {
            const result = gradeGrammarAnswers(twoBlankPlan, ['すし', 'anything'], [0, 2]);
            expect(result.perBlankResults[0]).toBe('correct');
            expect(result.perBlankResults[1]).toBe('minor_error');
            expect(result.overall).toBe('minor_error');
        });

        it('all correct grades overall correct', () => {
            const result = gradeGrammarAnswers(twoBlankPlan, ['すし', 'なか'], [0, 0]);
            expect(result.overall).toBe('correct');
        });
    });

    describe('pattern decides the result; vocab only scales the reward (issue #33 follow-up)', () => {
        // blank 0 = grammar pattern marker, blank 1 = vocab reinforcement.
        const plan = { acceptLists: [['いちばん'], ['すし']], isPatternBlank: [true, false] };

        it('pattern correct + vocab wrong stays a success (correct), never wrong', () => {
            const result = gradeGrammarAnswers(plan, ['いちばん', 'ねこ'], [0, 0]);
            expect(result.perBlankResults).toEqual(['correct', 'wrong']);
            expect(result.overall).toBe('correct');
        });

        it('pattern wrong is wrong even when every vocab blank is right', () => {
            const result = gradeGrammarAnswers(plan, ['ちがう', 'すし'], [0, 0]);
            expect(result.overall).toBe('wrong');
            expect(result.strengthDeltaModifier).toBe(1);
        });

        it('a missed vocab blank reduces the strength gain but not below the floor', () => {
            const bothMissed = gradeGrammarAnswers(plan, ['いちばん', 'ねこ'], [0, 0]);
            expect(bothMissed.strengthDeltaModifier).toBe(0.5); // 1 pattern ok, 0/1 vocab -> floor

            const bothRight = gradeGrammarAnswers(plan, ['いちばん', 'すし'], [0, 0]);
            expect(bothRight.strengthDeltaModifier).toBe(1); // all vocab right -> full gain
        });

        it('partial vocab success scales the coefficient linearly between floor and 1', () => {
            const twoVocab = { acceptLists: [['いちばん'], ['すし'], ['なか']], isPatternBlank: [true, false, false] };
            const result = gradeGrammarAnswers(twoVocab, ['いちばん', 'すし', 'ねこ'], [0, 0, 0]);
            expect(result.overall).toBe('correct');
            expect(result.strengthDeltaModifier).toBe(0.75); // floor 0.5 + 0.5 * (1/2)
        });

        it('with no vocab blanks the coefficient is a full 1', () => {
            const patternOnly = { acceptLists: [['いちばん']], isPatternBlank: [true] };
            const result = gradeGrammarAnswers(patternOnly, ['いちばん'], [0]);
            expect(result.strengthDeltaModifier).toBe(1);
        });
    });
});

describe('selectCurrentGrammarProgress', () => {
    it('returns null without a currentGrammarPoint', () => {
        expect(selectCurrentGrammarProgress({ currentGrammarPoint: null, progress: makeProgress() })).toBeNull();
    });

    it('finds the matching GrammarProgress by id', () => {
        const point = makeGrammarPoint();
        const gp = makeGrammarProgress({ grammarId: point.id });
        const result = selectCurrentGrammarProgress({ currentGrammarPoint: point, progress: makeProgress({ grammarQueue: [gp] }) });
        expect(result).toBe(gp);
    });
});

describe('selectNextGrammarSessionPreview', () => {
    it('buckets retries, new, and review as mutually exclusive, retries taking precedence', () => {
        const progress = makeProgress({
            grammarQueue: [
                makeGrammarProgress({ grammarId: 'retry-1', needsRetry: true, totalReviews: 1 }),
                makeGrammarProgress({ grammarId: 'new-1', totalReviews: 0 }),
                makeGrammarProgress({ grammarId: 'review-1', totalReviews: 1, entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } }),
                makeGrammarProgress({ grammarId: 'graduated-1', stage: 'graduated', totalReviews: 5 }),
            ],
        });

        const preview = selectNextGrammarSessionPreview({ progress }, now);
        expect(preview).toEqual({ review: 1, new: 1, retries: 1 });
    });

    it('is all-zero without progress', () => {
        expect(selectNextGrammarSessionPreview({ progress: null }, now)).toEqual({ review: 0, new: 0, retries: 0 });
    });
});

describe('collectActionableGrammarIds', () => {
    it('includes a due point and a needsRetry point, excludes not-yet-due and graduated', () => {
        const queue: GrammarProgress[] = [
            makeGrammarProgress({ grammarId: 'due', entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } }),
            makeGrammarProgress({ grammarId: 'retry', needsRetry: true, entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: future } }),
            makeGrammarProgress({ grammarId: 'not-due', entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: future } }),
            makeGrammarProgress({ grammarId: 'graduated', stage: 'graduated', needsRetry: true, entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } }),
        ];

        expect(collectActionableGrammarIds(queue, now).sort()).toEqual(['due', 'retry'].sort());
    });
});

describe('selectGrammarSessionStats', () => {
    function stateWith(queue: GrammarProgress[], committed: string[]) {
        return { progress: makeProgress({ grammarQueue: queue }), grammarSession: { committed } };
    }

    it('returns zeros without progress', () => {
        const stats = selectGrammarSessionStats({ progress: null, grammarSession: null }, false, now);
        expect(stats).toEqual({ done: 0, total: 0, retriesPending: 0, waiting: 0, moreNew: false });
    });

    it('total is the committed set size; done counts committed points no longer actionable', () => {
        const stillDue = makeGrammarProgress({ grammarId: 'a', entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } });
        const answered = makeGrammarProgress({ grammarId: 'b', entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: future } });
        const state = stateWith([stillDue, answered], ['a', 'b']);

        const stats = selectGrammarSessionStats(state, false, now);
        expect(stats.total).toBe(2);
        expect(stats.done).toBe(1); // only 'b' (answered) is no longer actionable
    });

    it('retriesPending counts committed points currently awaiting a retry', () => {
        const retrying = makeGrammarProgress({ grammarId: 'a', needsRetry: true, entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } });
        const state = stateWith([retrying], ['a']);

        const stats = selectGrammarSessionStats(state, false, now);
        expect(stats.done).toBe(0);
        expect(stats.retriesPending).toBe(1);
    });

    it('waiting counts actionable points that were NOT committed (came due mid-session)', () => {
        const midSessionArrival = makeGrammarProgress({ grammarId: 'c', entry: { ...DEFAULT_GRAMMAR_PROGRESS.entry, dueDate: past } });
        const state = stateWith([midSessionArrival], []);

        const stats = selectGrammarSessionStats(state, true, now);
        expect(stats.total).toBe(0);
        expect(stats.waiting).toBe(1);
        expect(stats.moreNew).toBe(true);
    });
});

describe('computeConjugationPlan / computeBlankPlan for inflection points', () => {
    const tePoint = {
        id: 'n5-046',
        title: 'Verb て～',
        jlptLevel: 5,
        kind: 'inflection' as const,
        derives: 'て-form',
        shortExplanation: '', longExplanation: '', formation: '',
        examples: [{ jp: '待って', romaji: '', en: '', words: [{ surface: '待って', vocabId: null }], patternWordIndices: [0] }],
    } as unknown as GrammarPoint;

    const conjugations = {
        'n5-046': {
            form: 'te' as const,
            formLabel: 'て-form',
            items: [
                { vocabId: 'v1', lemma: '飲む', lemmaReading: 'のむ', target: '飲んで', targetReading: 'のんで', wordClass: 'godan' as const },
                { vocabId: 'v2', lemma: '書く', lemmaReading: 'かく', target: '書いて', targetReading: 'かいて', wordClass: 'godan' as const },
                { vocabId: 'v3', lemma: 'する', lemmaReading: 'する', target: 'して', targetReading: 'して', wordClass: 'irregular' as const },
            ],
        },
    };

    afterEach(() => { vi.restoreAllMocks(); });

    it('serves a conjugation drill instead of a sentence cloze', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);

        const plan = await computeBlankPlan(tePoint, null, 0);

        expect(plan?.conjugation).toBeDefined();
        expect(plan?.conjugation?.formLabel).toBe('て-form');
        // One blank, and it decides the point's result - the derivation IS the point.
        expect(plan?.blankWordIndices).toEqual([0]);
        expect(plan?.isPatternBlank).toEqual([true]);
        expect(plan?.readOnly).toBe(false);
    });

    it('accepts both the kanji and the kana form of the answer', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);

        const plan = await computeBlankPlan(tePoint, null, 0);
        const accepted = plan!.acceptLists[0];

        expect(accepted).toContain(plan!.conjugation!.target);
        // Whichever item was picked, its reading is accepted too.
        const item = conjugations['n5-046'].items.find(i => i.target === plan!.conjugation!.target)!;
        expect(accepted).toContain(item.targetReading);
    });

    it('includes dataset-marked alternatives in the accept list', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({
            'n4-020': {
                form: 'causative-passive' as const,
                formLabel: 'causative-passive',
                items: [{
                    vocabId: 'v1', lemma: '書く', lemmaReading: 'かく',
                    target: '書かせられる', targetReading: 'かかせられる',
                    // Both are standard Japanese; the contracted one is commoner in speech.
                    alternatives: ['書かされる', 'かかされる'],
                    wordClass: 'godan' as const,
                }],
            },
        });

        const point = { ...tePoint, id: 'n4-020' } as GrammarPoint;
        const plan = await computeBlankPlan(point, null, 0);

        expect(plan!.acceptLists[0]).toEqual(expect.arrayContaining(['書かせられる', 'かかせられる', '書かされる', 'かかされる']));
    });

    it('picks deterministically for a turn, and cycles across reviews', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);

        const a = await computeBlankPlan(tePoint, null, 3);
        const b = await computeBlankPlan(tePoint, null, 3);
        expect(a?.conjugation?.lemma).toBe(b?.conjugation?.lemma);

        const lemmas = new Set<string>();
        for (let i = 0; i < 12; i++) {
            const plan = await computeBlankPlan(tePoint, null, i);
            lemmas.add(plan!.conjugation!.lemma);
        }
        expect(lemmas.size).toBeGreaterThan(1);
    });

    it('grades a conjugation answer through the unchanged grading path', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);
        const plan = await computeBlankPlan(tePoint, null, 0);
        const target = plan!.conjugation!.target;

        const right = gradeGrammarAnswers(plan!, [target], [0]);
        expect(right.overall).toBe('correct');

        const wrong = gradeGrammarAnswers(plan!, ['まちがい'], [0]);
        expect(wrong.overall).toBe('wrong');
    });

    it('falls back to the cloze path when the dataset has no items for the point', async () => {
        // A partially-built dataset must degrade, not break. The pipeline filter
        // keeps such a point out of circulation anyway.
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});

        const plan = await computeBlankPlan(tePoint, null, 0);

        expect(plan?.conjugation).toBeUndefined();
        expect(plan).not.toBeNull();
    });

    it('leaves construction points on the cloze path entirely', async () => {
        const loadConjugations = vi.spyOn(GrammarService, 'loadConjugations');
        const construction = { ...tePoint, id: 'n4-110', kind: 'construction' as const, derives: undefined } as GrammarPoint;

        const plan = await computeBlankPlan(construction, null, 0);

        expect(plan?.conjugation).toBeUndefined();
        expect(loadConjugations).not.toHaveBeenCalled();
    });
});

// Coverage for the base-conjugation-paradigm rollout (23 new inflection
// points, dataset commit dd5e033879): a base-paradigm point (plain past) and
// a copula point (na-adjective だ), plus a point that carries real
// alternatives (na-adjective negative polite). Item shapes below are trimmed
// straight from the compiled conjugations.json for these ids.
describe('base-conjugation paradigm points (n5-905 plain-past, n5-911 na-adjective copula)', () => {
    const plainPastPoint = {
        id: 'n5-905',
        title: 'Plain past: Verb た',
        jlptLevel: 5,
        kind: 'inflection' as const,
        derives: 'plain past (た)',
        shortExplanation: '', longExplanation: '', formation: '',
        examples: [],
    } as unknown as GrammarPoint;

    const copulaPoint = {
        id: 'n5-911',
        title: 'Plain: Na-adjective だ',
        jlptLevel: 5,
        kind: 'inflection' as const,
        derives: 'plain (だ)',
        shortExplanation: '', longExplanation: '', formation: '',
        examples: [],
    } as unknown as GrammarPoint;

    const negativePolitePoint = {
        id: 'n5-917',
        title: 'Negative polite: Na-adjective じゃないです',
        jlptLevel: 5,
        kind: 'inflection' as const,
        derives: 'negative polite (じゃないです)',
        shortExplanation: '', longExplanation: '', formation: '',
        examples: [],
    } as unknown as GrammarPoint;

    const conjugations = {
        'n5-905': {
            form: 'plain-past' as const,
            formLabel: 'plain past (た)',
            items: [
                { vocabId: '1589350', lemma: '思う', lemmaReading: 'おもう', target: '思った', targetReading: 'おもった', wordClass: 'godan' as const },
                { vocabId: '1547720', lemma: '来る', lemmaReading: 'くる', target: '来た', targetReading: 'きた', wordClass: 'irregular' as const },
                { vocabId: '1157170', lemma: 'する', lemmaReading: 'する', target: 'した', targetReading: 'した', wordClass: 'irregular' as const },
            ],
        },
        'n5-911': {
            form: 'na-adj' as const,
            formLabel: 'plain (だ)',
            items: [
                { vocabId: '1277450', lemma: '好き', lemmaReading: 'すき', target: '好きだ', targetReading: 'すきだ', wordClass: 'na-adjective' as const },
                { vocabId: '1487660', lemma: '必要', lemmaReading: 'ひつよう', target: '必要だ', targetReading: 'ひつようだ', wordClass: 'na-adjective' as const },
            ],
        },
        'n5-917': {
            form: 'na-adj-negative-polite' as const,
            formLabel: 'negative polite (じゃないです)',
            items: [
                {
                    vocabId: '1277450', lemma: '好き', lemmaReading: 'すき',
                    target: '好きじゃないです', targetReading: 'すきじゃないです',
                    alternatives: ['好きじゃありません', 'すきじゃありません', '好きではありません', 'すきではありません'],
                    wordClass: 'na-adjective' as const,
                },
            ],
        },
    };

    afterEach(() => { vi.restoreAllMocks(); });

    it('produces a valid conjugation plan for the plain-past point', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);

        const plan = await computeBlankPlan(plainPastPoint, null, 0);

        expect(plan).not.toBeNull();
        expect(plan?.conjugation?.formLabel).toBe('plain past (た)');
        expect(plan?.blankWordIndices).toEqual([0]);
        expect(plan?.isPatternBlank).toEqual([true]);
        expect(plan?.readOnly).toBe(false);
    });

    it('produces a valid conjugation plan for the na-adjective copula point', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);

        const plan = await computeBlankPlan(copulaPoint, null, 0);

        expect(plan).not.toBeNull();
        expect(plan?.conjugation?.formLabel).toBe('plain (だ)');
        expect(plan?.conjugation?.wordClass).toBe('na-adjective');
        expect(plan?.blankWordIndices).toEqual([0]);
        expect(plan?.isPatternBlank).toEqual([true]);
        expect(plan?.readOnly).toBe(false);
    });

    it('grades both the kanji and kana form of the plain-past answer as correct', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);
        const plan = await computeBlankPlan(plainPastPoint, null, 0);
        const item = conjugations['n5-905'].items.find(i => i.target === plan!.conjugation!.target)!;

        expect(gradeGrammarAnswers(plan!, [item.target], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(plan!, [item.targetReading], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(plan!, ['ちがう'], [0]).overall).toBe('wrong');
    });

    it('grades both the kanji and kana form of the copula answer as correct', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);
        const plan = await computeBlankPlan(copulaPoint, null, 0);
        const item = conjugations['n5-911'].items.find(i => i.target === plan!.conjugation!.target)!;

        expect(gradeGrammarAnswers(plan!, [item.target], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(plan!, [item.targetReading], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(plan!, ['ちがう'], [0]).overall).toBe('wrong');
    });

    it('accepts both real alternatives (じゃありません and ではありません) for the negative polite form', async () => {
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue(conjugations);
        const plan = await computeBlankPlan(negativePolitePoint, null, 0);

        expect(plan!.acceptLists[0]).toEqual(expect.arrayContaining([
            '好きじゃないです', 'すきじゃないです',
            '好きじゃありません', 'すきじゃありません',
            '好きではありません', 'すきではありません',
        ]));
        expect(gradeGrammarAnswers(plan!, ['好きじゃありません'], [0]).overall).toBe('correct');
        expect(gradeGrammarAnswers(plan!, ['好きではありません'], [0]).overall).toBe('correct');

        // Only the kanji-bearing alternatives surface in the prompt/feedback -
        // the pure-kana ones are already covered by acceptLists, and listing
        // both spellings of each would read as four answers rather than two.
        expect(plan!.conjugation!.alternatives).toEqual(['好きじゃありません', '好きではありません']);
    });
});

describe('realization variant rotation and two-tier grading', () => {
    // Modelled on the real `nowhere` group: a particle slot (に / へ / none)
    // crossed with a politeness slot (ません / ないです).
    function makeVariantPoint(id: string, title: string, pattern: string, formality: string): GrammarPoint {
        const words = [{ surface: pattern, vocabId: null }, { surface: '行きません', vocabId: null }];
        return {
            id, title, jlptLevel: 5, kind: 'construction',
            shortExplanation: '', longExplanation: '', formation: '',
            formalityLevel: formality,
            examples: [{ jp: pattern + '行きません', romaji: '', en: 'I do not go anywhere.', words, patternWordIndices: [0] }],
        } as unknown as GrammarPoint;
    }

    const canonical = makeVariantPoint('n5-105', 'どこにも ません', 'どこにも', 'polite');
    const siblings: Record<string, GrammarPoint> = {
        'n5-107': makeVariantPoint('n5-107', 'どこへも ません', 'どこへも', 'polite'),
        'n5-109': makeVariantPoint('n5-109', 'どこも ません', 'どこも', 'polite'),
        // Differing register AND a differing blanked surface - the only case
        // where the minor tier can apply. Where the surface is identical, the
        // register is simply untestable by that blank and 'correct' is right.
        'n5-104': makeVariantPoint('n5-104', 'どこにも ないです', 'どこにもないです', 'neutral'),
    };
    const group = {
        'n5-105': [
            { id: 'n5-105', relation: 'canonical', formalityLevel: 'polite', title: 'どこにも ません' },
            { id: 'n5-107', relation: 'particle', formalityLevel: 'polite', title: 'どこへも ません' },
            { id: 'n5-109', relation: 'particle', formalityLevel: 'polite', title: 'どこも ません' },
            { id: 'n5-104', relation: 'politeness', formalityLevel: 'neutral', title: 'どこにもないです' },
        ],
    } as never;

    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadVariantGroups').mockResolvedValue(group);
        vi.spyOn(GrammarService, 'loadConjugations').mockResolvedValue({});
        vi.spyOn(GrammarService, 'loadGrammarPoint').mockImplementation(async (id: string) =>
            (siblings[id] ?? canonical));
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('drills one realization per turn and rotates between reviews', async () => {
        const seen = new Set<string>();
        for (let i = 0; i < 16; i++) {
            const plan = await computeBlankPlan(canonical, null, i);
            expect(plan?.realization).toBeDefined();
            expect(plan!.realization!.canonicalId).toBe('n5-105');
            expect(plan!.realization!.total).toBe(4);
            seen.add(plan!.realization!.pointId);
        }
        // The whole point: the learner meets every form of the rule, not just one.
        expect(seen.size).toBeGreaterThan(1);
    });

    it('is stable within a single turn', async () => {
        const a = await computeBlankPlan(canonical, null, 5);
        const b = await computeBlankPlan(canonical, null, 5);
        expect(a?.realization?.pointId).toBe(b?.realization?.pointId);
    });

    it('accepts a same-register sibling as correct: the particles are interchangeable', async () => {
        const plan = await computeBlankPlan(canonical, null, 0);
        const politeForms = ['どこにも', 'どこへも', 'どこも'];
        const accepted = plan!.acceptLists[0];
        // Every polite realization is acceptable, whichever one was asked for.
        const overlap = politeForms.filter(f => accepted.includes(f));
        expect(overlap.length).toBeGreaterThanOrEqual(2);

        for (const form of overlap) {
            expect(gradeGrammarAnswers(plan!, [form], [0]).overall).toBe('correct');
        }
    });

    it('downgrades a wrong-register realization to minor_error, not wrong', async () => {
        // The card showed the register, so this is a near miss rather than a failure.
        let planWithMinor = null as Awaited<ReturnType<typeof computeBlankPlan>>;
        for (let i = 0; i < 16; i++) {
            const p = await computeBlankPlan(canonical, null, i);
            if ((p?.acceptListsMinor?.[0]?.length ?? 0) > 0) { planWithMinor = p; break; }
        }
        expect(planWithMinor, 'expected a turn with a differing-register sibling').not.toBeNull();

        const minorForm = planWithMinor!.acceptListsMinor![0][0];
        expect(gradeGrammarAnswers(planWithMinor!, [minorForm], [0]).overall).toBe('minor_error');
    });

    it('still grades an unrelated answer wrong', async () => {
        const plan = await computeBlankPlan(canonical, null, 0);
        expect(gradeGrammarAnswers(plan!, ['まったくちがう'], [0]).overall).toBe('wrong');
    });

    it('never widens a vocab blank, only the pattern blanks', async () => {
        const plan = await computeBlankPlan(canonical, null, 0);
        plan!.isPatternBlank.forEach((isPattern, i) => {
            if (!isPattern) expect(plan!.acceptListsMinor?.[i] ?? []).toEqual([]);
        });
    });

    it('leaves a point with no variant group completely unchanged', async () => {
        vi.spyOn(GrammarService, 'loadVariantGroups').mockResolvedValue({});
        const plan = await computeBlankPlan(canonical, null, 0);
        expect(plan?.realization).toBeUndefined();
        // acceptListsMinor is now always present (every plan carries a minor tier, for
        // inflected vocab blanks), so the invariant is that it offers no near-miss
        // forms here rather than that the field is absent.
        expect(plan?.acceptListsMinor?.every(list => list.length === 0)).toBe(true);
    });
});

describe('summariseVocabGains', () => {
    const entry = (strength: number) => ({
        memoryStrength: strength, interval: 1, difficulty: 0.3,
        lastReviewedAt: null, dueDate: null, history: [],
    });
    // `strength` moves the PRODUCTION entry, because that is where
    // applyVocabReinforcement puts the credit and therefore what this must measure.
    const word = (vocabId: string, strength: number) => ({
        vocabId, stage: 'learning' as const, introductionAt: null, nextReviewAt: null,
        lastReviewedAt: null, totalReviews: 1, consecutiveFailures: 0,
        reading: entry(100), meaning: entry(100), production: entry(strength),
    });
    const words = [
        { surface: '私', vocabId: 'a', baseForm: undefined },
        { surface: '思っ', vocabId: 'b', baseForm: '思う' },
    ];

    it('reports nothing when the queue was not touched (same reference)', () => {
        const queue = [word('a', 100)];
        expect(summariseVocabGains(queue, queue, words)).toEqual({ total: 0, breakdown: [] });
    });

    it('splits the gain per word and sums it', () => {
        const before = [word('a', 100), word('b', 100)];
        const after = [word('a', 140), word('b', 200)];

        const { total, breakdown } = summariseVocabGains(before, after, words);

        expect(breakdown).toHaveLength(2);
        expect(total).toBeCloseTo(breakdown.reduce((s, w) => s + w.delta, 0), 5);
    });

    it('orders the breakdown by biggest gain first', () => {
        const before = [word('a', 100), word('b', 100)];
        const after = [word('a', 120), word('b', 300)];

        const { breakdown } = summariseVocabGains(before, after, words);

        expect(breakdown[0].label).toBe('思う');
        expect(breakdown[0].delta).toBeGreaterThan(breakdown[1].delta);
    });

    it('labels a word by its dictionary form, not the inflected surface in the sentence', () => {
        // "思う +3" is a word the learner can look up; "思っ +3" is a fragment.
        const { breakdown } = summariseVocabGains([word('b', 100)], [word('b', 200)], words);
        expect(breakdown[0].label).toBe('思う');
    });

    it('uses the surface when the word has no separate dictionary form', () => {
        const { breakdown } = summariseVocabGains([word('a', 100)], [word('a', 200)], words);
        expect(breakdown[0].label).toBe('私');
    });

    it('skips words whose strength did not move', () => {
        const before = [word('a', 100), word('b', 100)];
        const after = [{ ...word('a', 100) }, word('b', 200)]; // 'a' is a new object but unchanged
        const { breakdown } = summariseVocabGains(before, after, words);

        expect(breakdown.map(w => w.label)).toEqual(['思う']);
    });

    it('falls back to the vocab id when the sentence has no matching word', () => {
        const { breakdown } = summariseVocabGains([word('z', 100)], [word('z', 200)], words);
        expect(breakdown[0].label).toBe('z');
    });
});

describe('family interchange (issue #62): slot-gated, axis-tiered', () => {
    const sibling = (id: string, slot: GrammarPoint['slot'], axis: 'register' | 'constraint' | 'variant', formalityLevel: GrammarPoint['formalityLevel'], marker: string): GrammarPoint =>
        makeGrammarPoint({
            id,
            slot,
            formalityLevel,
            family: { id: 'contradiction', name: 'Contradiction', relatedPoints: [], axis },
            examples: [{ jp: marker, romaji: '', en: '', patternWordIndices: [0], words: [{ surface: marker, vocabId: null }] }],
        });

    const point = makeGrammarPoint({
        id: 'kedo',
        slot: 'clause-final',
        formalityLevel: 'casual',
        family: { id: 'contradiction', name: 'Contradiction', relatedPoints: ['sib-same', 'sib-other', 'sib-diffslot', 'sib-constraint'], axis: 'register' },
        examples: [{
            jp: 'けど、そう', romaji: '', en: '', patternWordIndices: [0],
            words: [{ surface: 'けど', vocabId: null }, { surface: '、', vocabId: null }, { surface: 'そう', vocabId: null }],
        }],
    });

    const siblings: Record<string, GrammarPoint> = {
        'sib-same': sibling('sib-same', 'clause-final', 'register', 'casual', 'だけど'),      // same slot, same register -> correct
        'sib-other': sibling('sib-other', 'clause-final', 'register', 'formal', 'ものの'),     // same slot, other register -> minor
        'sib-diffslot': sibling('sib-diffslot', 'sentence-initial', 'register', 'casual', 'でも'), // different slot -> excluded
        'sib-constraint': sibling('sib-constraint', 'clause-final', 'constraint', 'casual', 'それでも'), // constraint -> excluded
    };

    beforeEach(() => {
        vi.spyOn(GrammarService, 'loadVariantGroups').mockResolvedValue({});
        vi.spyOn(GrammarService, 'loadGrammarPoint').mockImplementation(async (id: string) => {
            const p = siblings[id];
            if (!p) throw new Error(`no sibling ${id}`);
            return p;
        });
    });

    it('accepts a same-slot same-register sibling as correct, a same-slot other-register sibling as minor', async () => {
        const plan = (await computeBlankPlan(point, makeProgress({ learningQueue: [] }), 0))!;
        expect(plan.isPatternBlank[0]).toBe(true);
        expect(plan.acceptLists[0]).toContain('だけど');
        expect(plan.acceptListsMinor![0]).toContain('ものの');
    });

    it('excludes a different-slot sibling (ungrammatical substitution) and a constraint sibling (changes meaning)', async () => {
        const plan = (await computeBlankPlan(point, makeProgress({ learningQueue: [] }), 0))!;
        const all = [...plan.acceptLists[0], ...(plan.acceptListsMinor?.[0] ?? [])];
        expect(all).not.toContain('でも');
        expect(all).not.toContain('それでも');
    });

    it('does nothing when the point has no slot', async () => {
        const noSlot = makeGrammarPoint({ ...point, slot: undefined });
        const plan = (await computeBlankPlan(noSlot, makeProgress({ learningQueue: [] }), 0))!;
        expect(plan.acceptLists[0]).toEqual(['けど']);
        expect(plan.acceptListsMinor?.[0] ?? []).toEqual([]);
    });
});

describe('selectChapterEndFocusIds', () => {
    function makeContrasts(overrides: Partial<GrammarContrastIndex> = {}): GrammarContrastIndex {
        return {
            causality: {
                name: 'Causality',
                lessons: [
                    {
                        id: 'reason-core',
                        title: 'から / ので',
                        points: ['n5-073', 'n4-110'],
                        cases: [{ focus: 'n4-110', vs: ['n5-073'], situation: 's', guidance: 'g' }],
                        taughtInChapterId: 'n4-c12',
                    },
                    {
                        id: 'reason-written',
                        title: 'だから / なぜなら',
                        points: ['n5-073', 'n5-088', 'n3-072'],
                        cases: [{ focus: 'n3-072', vs: ['n5-088'], situation: 's2', guidance: 'g2' }],
                        taughtInChapterId: 'n5-c16',
                    },
                ],
            },
            ...overrides,
        };
    }

    it('collects the focus ids of lessons anchored to the given chapter', () => {
        expect(selectChapterEndFocusIds(makeContrasts(), 'n4-c12')).toEqual(['n4-110']);
        expect(selectChapterEndFocusIds(makeContrasts(), 'n5-c16')).toEqual(['n3-072']);
    });

    it('returns nothing for a chapter with no anchored lessons', () => {
        expect(selectChapterEndFocusIds(makeContrasts(), 'n1-c99')).toEqual([]);
    });

    it('dedupes when two cases in different lessons share the same focus and anchor', () => {
        const contrasts = makeContrasts({
            causality: {
                name: 'Causality',
                lessons: [
                    {
                        id: 'a', title: 'a', points: ['n4-110', 'n5-073'],
                        cases: [{ focus: 'n4-110', vs: ['n5-073'], situation: 's', guidance: 'g' }],
                        taughtInChapterId: 'n4-c12',
                    },
                    {
                        id: 'b', title: 'b', points: ['n4-110', 'n5-088'],
                        cases: [{ focus: 'n4-110', vs: ['n5-088'], situation: 's2', guidance: 'g2' }],
                        taughtInChapterId: 'n4-c12',
                    },
                ],
            },
        });
        expect(selectChapterEndFocusIds(contrasts, 'n4-c12')).toEqual(['n4-110']);
    });

    it('ignores families with no lessons at all (interchangeable-only)', () => {
        const contrasts: GrammarContrastIndex = {
            'regardless-a-or-b': { name: 'Regardless', lessons: [], interchangeable: ['n1-a', 'n1-b'] },
        };
        expect(selectChapterEndFocusIds(contrasts, 'n1-c01')).toEqual([]);
    });
});

describe('selectNewlyCompletedChapterIds', () => {
    const chapters: GrammarChapter[] = [
        { id: 'c01', title: 'C1', summary: '', jlptLevel: 5, points: ['n5-a', 'n5-b'] },
        { id: 'c02', title: 'C2', summary: '', jlptLevel: 5, points: ['n5-c'] },
    ];
    const alwaysTeachable = () => true;

    it('reports a chapter complete once every point is introduced', () => {
        const queue = [
            makeGrammarProgress({ grammarId: 'n5-a', introductionAt: now }),
            makeGrammarProgress({ grammarId: 'n5-b', introductionAt: now }),
        ];
        expect(selectNewlyCompletedChapterIds(chapters, queue, [], alwaysTeachable)).toEqual(['c01']);
    });

    it('does not report a chapter with an un-introduced point', () => {
        const queue = [makeGrammarProgress({ grammarId: 'n5-a', introductionAt: now })];
        expect(selectNewlyCompletedChapterIds(chapters, queue, [], alwaysTeachable)).toEqual([]);
    });

    it('excludes a chapter already recorded as completed', () => {
        const queue = [
            makeGrammarProgress({ grammarId: 'n5-a', introductionAt: now }),
            makeGrammarProgress({ grammarId: 'n5-b', introductionAt: now }),
        ];
        expect(selectNewlyCompletedChapterIds(chapters, queue, ['c01'], alwaysTeachable)).toEqual([]);
    });

    it('a chapter with an untestable point completes once every OTHER point is introduced', () => {
        const isTeachable = (id: string) => id !== 'n5-b';
        const queue = [makeGrammarProgress({ grammarId: 'n5-a', introductionAt: now })];
        expect(selectNewlyCompletedChapterIds(chapters, queue, [], isTeachable)).toEqual(['c01']);
    });

    it('reports every newly-completed chapter, in chapter order', () => {
        const queue = [
            makeGrammarProgress({ grammarId: 'n5-a', introductionAt: now }),
            makeGrammarProgress({ grammarId: 'n5-b', introductionAt: now }),
            makeGrammarProgress({ grammarId: 'n5-c', introductionAt: now }),
        ];
        expect(selectNewlyCompletedChapterIds(chapters, queue, [], alwaysTeachable)).toEqual(['c01', 'c02']);
    });

    it('a queued-but-not-yet-introduced point does not count', () => {
        const queue = [
            makeGrammarProgress({ grammarId: 'n5-a', introductionAt: now }),
            makeGrammarProgress({ grammarId: 'n5-b', introductionAt: null }),
        ];
        expect(selectNewlyCompletedChapterIds(chapters, queue, [], alwaysTeachable)).toEqual([]);
    });
});
