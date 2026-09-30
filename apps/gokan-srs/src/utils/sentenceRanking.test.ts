import { describe, it, expect } from 'vitest';
import {
    indexLearnerVocab,
    productionRing,
    wordRole,
    scoreGrammarExample,
    scoreVocabSentence,
    compareSentenceScores,
    pickMostProductive,
    pickSentenceForVocab,
} from './sentenceRanking';
import type { VocabProgress } from '../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import type { Sentence } from '../models/sentence.model';
import type { GrammarExample } from '../models/grammar.model';
import { CONSTANTS } from '../commons/constants';

const past = new Date('2026-06-01T00:00:00Z');
const future = new Date('2026-07-01T00:00:00Z');
const SOFT_CAP = CONSTANTS.srs.formula.mastery.visualSoftCap;

/** An introduced word whose production entry is activated at the given strength. */
function learning(vocabId: string, productionStrength?: number): VocabProgress {
    return {
        ...DEFAULT_VOCABULARY_PROGRESS,
        vocabId,
        introductionAt: past,
        ...(productionStrength !== undefined ? {
            production: {
                memoryStrength: productionStrength,
                interval: 1,
                difficulty: 0.5,
                lastReviewedAt: past,
                dueDate: future,
                history: [],
            },
        } : {}),
    };
}

function sentence(id: string, vocabIds: string[], overrides: Partial<Sentence> = {}): Sentence {
    return { id, original: id, en: [{ id: `${id}-en`, text: id }], vocabIds, ...overrides };
}

function grammarExample(overrides: Partial<GrammarExample> = {}): GrammarExample {
    return {
        jp: 'X',
        romaji: '',
        en: 'x',
        patternWordIndices: [],
        words: [],
        ...overrides,
    };
}

describe('productionRing / wordRole', () => {
    it('reads 0 while production is not activated, and the word is still a target', () => {
        const learner = indexLearnerVocab([learning('v1')]);
        expect(productionRing(learner.get('v1')!)).toBe(0);
        expect(wordRole('v1', learner)).toBe('target');
    });

    it('is unknown when the word is absent or queued but never introduced', () => {
        const learner = indexLearnerVocab([{ ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'queued', introductionAt: null }]);
        expect(wordRole('absent', learner)).toBe('unknown');
        expect(wordRole('queued', learner)).toBe('unknown');
    });

    it('turns into context exactly when the production ring fills its first loop', () => {
        const learner = indexLearnerVocab([learning('below', SOFT_CAP * 0.9), learning('full', SOFT_CAP)]);
        expect(productionRing(learner.get('below')!)).toBeLessThan(100);
        expect(wordRole('below', learner)).toBe('target');
        expect(productionRing(learner.get('full')!)).toBe(100);
        expect(wordRole('full', learner)).toBe('context');
    });
});

describe('scoreGrammarExample', () => {
    it('counts targets, unknowns and the targets\' summed production ring from resolved words', () => {
        const learner = indexLearnerVocab([learning('t1', 10), learning('t2'), learning('ctx', SOFT_CAP)]);
        const example = grammarExample({
            jp: 'sentence',
            words: [
                { surface: 'a', vocabId: 't1' },
                { surface: 'b', vocabId: 't2' },
                { surface: 'c', vocabId: 'ctx' },
                { surface: 'd', vocabId: 'u1' },
                { surface: 'e', vocabId: 'u2' },
            ],
        });
        const score = scoreGrammarExample(example, learner);
        expect(score.targets).toBe(2);
        expect(score.unknownWeight).toBe(2);
        expect(score.progress).toBeCloseTo(productionRing(learner.get('t1')!));
        expect(score.length).toBe('sentence'.length);
    });

    it('counts a repeated word once and excludes pattern-marker indices entirely', () => {
        const learner = indexLearnerVocab([learning('t1')]);
        const example = grammarExample({
            words: [
                { surface: 'a', vocabId: 't1' },
                { surface: 'a', vocabId: 't1' },
                { surface: 'mark', vocabId: 'unrelated-unknown' },
            ],
            patternWordIndices: [2],
        });
        const score = scoreGrammarExample(example, learner);
        expect(score).toMatchObject({ targets: 1, unknownWeight: 0, progress: 0 });
    });

    it('weighs an unresolved word containing kanji as 1', () => {
        const example = grammarExample({ words: [{ surface: '漢字', vocabId: null }] });
        expect(scoreGrammarExample(example, indexLearnerVocab([])).unknownWeight).toBe(1);
    });

    it('weighs an unresolved katakana-only word of 2+ characters as unresolvedKatakanaWeight', () => {
        const example = grammarExample({ words: [{ surface: 'カタ', vocabId: null }] });
        expect(scoreGrammarExample(example, indexLearnerVocab([])).unknownWeight)
            .toBe(CONSTANTS.srs.sentenceSelection.unresolvedKatakanaWeight);
    });

    it('weighs unresolved hiragana, punctuation and a single katakana character as 0', () => {
        const example = grammarExample({
            words: [
                { surface: 'です', vocabId: null },
                { surface: '。', vocabId: null },
                { surface: 'ト', vocabId: null },
            ],
        });
        expect(scoreGrammarExample(example, indexLearnerVocab([])).unknownWeight).toBe(0);
    });

    it('never scores a pattern-marker word, whether resolved or unresolved', () => {
        const kanjiMarker = grammarExample({ words: [{ surface: '漢字', vocabId: null }], patternWordIndices: [0] });
        expect(scoreGrammarExample(kanjiMarker, indexLearnerVocab([])).unknownWeight).toBe(0);

        const resolvedMarker = grammarExample({ words: [{ surface: 'x', vocabId: 'u1' }], patternWordIndices: [0] });
        expect(scoreGrammarExample(resolvedMarker, indexLearnerVocab([])).unknownWeight).toBe(0);
    });
});

describe('scoreVocabSentence', () => {
    it('counts targets, unknowns and progress from vocabIds, and skips excluded ids', () => {
        const learner = indexLearnerVocab([learning('t1', 10), learning('self')]);
        const s = sentence('s1', ['t1', 't1', 'self'], { original: '' });
        const score = scoreVocabSentence(s, learner, new Set(['self']));
        expect(score).toMatchObject({ targets: 1, unknownWeight: 0, progress: productionRing(learner.get('t1')!) });
    });

    it('counts an uncovered kanji run in `original` as one unresolved word', () => {
        const s = sentence('s1', [], { original: '明子さん' }); // no matches at all: fully uncovered
        // 明子 is a maximal kanji run (1); さん is hiragana (0).
        expect(scoreVocabSentence(s, indexLearnerVocab([])).unknownWeight).toBe(1);
    });

    it('counts an uncovered katakana run of 2+ chars as unresolvedKatakanaWeight, and a lone katakana char as 0', () => {
        const trailingKatakana = sentence('s1', [], { original: 'あトム' });
        expect(scoreVocabSentence(trailingKatakana, indexLearnerVocab([])).unknownWeight)
            .toBe(CONSTANTS.srs.sentenceSelection.unresolvedKatakanaWeight);

        const single = sentence('s2', [], { original: 'あト' });
        expect(scoreVocabSentence(single, indexLearnerVocab([])).unknownWeight).toBe(0);
    });

    it('does not count covered text toward the unresolved weight, and excludes the tested word from targets/unknowns while its span stays covered', () => {
        const learner = indexLearnerVocab([learning('self')]);
        const s = sentence('s1', ['self'], {
            original: '明子',
            matches: { self: [{ start: 0, length: 2 }] }, // the whole kanji run is covered by the tested word itself
        });
        const score = scoreVocabSentence(s, learner, new Set(['self']));
        expect(score).toEqual({ targets: 0, unknownWeight: 0, progress: 0, length: 2 });
    });

    it('scores two uncovered fragments separated by a covered word as two separate kanji runs, not one merged run', () => {
        const learner = indexLearnerVocab([learning('naka')]);
        // 田中 (uncovered) + 中 (covered, 'naka') + 山本 (uncovered): without per-fragment
        // scoring, concatenating uncovered text would wrongly read 田中 and 山本 as one
        // continuous 4-character run instead of two separate 2-character words.
        const s = sentence('s1', ['naka'], {
            original: '田中中山本',
            matches: { naka: [{ start: 2, length: 1 }] },
        });
        const score = scoreVocabSentence(s, learner, new Set());
        expect(score.unknownWeight).toBe(2); // 田中 (1) + 山本 (1), 中 excluded as covered
    });

    it('returns the character length of `original`', () => {
        const s = sentence('s1', [], { original: 'abcde' });
        expect(scoreVocabSentence(s, indexLearnerVocab([])).length).toBe(5);
    });
});

describe('compareSentenceScores', () => {
    const score = (overrides: Partial<{ unknownWeight: number; length: number; targets: number; progress: number }> = {}) => ({
        unknownWeight: 0, length: 5, targets: 0, progress: 0, ...overrides,
    });

    it('ranks lower unknownWeight first, regardless of targets or length', () => {
        expect(compareSentenceScores(
            score({ unknownWeight: 0, targets: 1, length: 100 }),
            score({ unknownWeight: 1, targets: 5, length: 1 }),
        )).toBeLessThan(0);
    });

    it('a short sentence with 0 unknowns beats a long one with 0 unknowns and more targets, once they land in different length bands', () => {
        const band = CONSTANTS.srs.sentenceSelection.lengthBand;
        expect(compareSentenceScores(
            score({ unknownWeight: 0, length: band, targets: 1 }),
            score({ unknownWeight: 0, length: band * 3, targets: 5 }),
        )).toBeLessThan(0);
    });

    it('within the same length band, more targets wins', () => {
        const band = CONSTANTS.srs.sentenceSelection.lengthBand;
        expect(compareSentenceScores(
            score({ unknownWeight: 0, length: 1, targets: 3 }),
            score({ unknownWeight: 0, length: band, targets: 2 }),
        )).toBeLessThan(0);
    });

    it('breaks an equal unknownWeight/band/target count on the summed production ring, highest first', () => {
        expect(compareSentenceScores(
            score({ targets: 3, progress: 210 }),
            score({ targets: 3, progress: 90 }),
        )).toBeLessThan(0);
    });

    it('reports an exact tie as 0', () => {
        const s = score({ unknownWeight: 2, targets: 1, progress: 40 });
        expect(compareSentenceScores(s, { ...s })).toBe(0);
    });
});

describe('pickMostProductive', () => {
    const score = (targets: number, progress = 0) => ({ unknownWeight: 0, length: 5, targets, progress });

    it('returns null for no candidates', () => {
        expect(pickMostProductive([], () => score(0), () => '', 'seed')).toBeNull();
    });

    it('resolves an exact tie the same way whatever the candidate order', () => {
        const items = ['a', 'b', 'c', 'd'];
        const forward = pickMostProductive(items, () => score(1), s => s, 'seed');
        const reversed = pickMostProductive([...items].reverse(), () => score(1), s => s, 'seed');
        expect(forward).toBe(reversed);
    });
});

describe('pickSentenceForVocab', () => {
    it('ignores the tested word itself and ranks by the words around it', () => {
        const learner = indexLearnerVocab([learning('self'), learning('t1'), learning('t2')]);
        // Same length (and so the same length band) for both ids, so the target
        // count - not the length key ahead of it - is what decides this pick.
        const sentences = [
            sentence('one-target', ['self', 't1']),
            sentence('two-target', ['self', 't1', 't2']),
        ];
        expect(pickSentenceForVocab('self', sentences, learner)?.id).toBe('two-target');
    });

    it('prefers a sentence of known words over one thick with unknown words', () => {
        const learner = indexLearnerVocab([learning('self'), learning('t1')]);
        const sentences = [
            sentence('hard', ['self', 't1', 'u1', 'u2', 'u3']),
            sentence('easy', ['self', 't1']),
        ];
        expect(pickSentenceForVocab('self', sentences, learner)?.id).toBe('easy');
    });

    it('keeps the same sentence while its words progress, then rotates once one reaches the ring ceiling', () => {
        const sentences = [
            sentence('A', ['self', 'a1', 'a2']),
            sentence('B', ['self', 'b1', 'b2']),
        ];
        // A's words are further along: A wins the progress tie-break and keeps winning as they grow.
        const early = indexLearnerVocab([learning('self'), learning('a1', 20), learning('a2', 20), learning('b1', 5), learning('b2', 5)]);
        expect(pickSentenceForVocab('self', sentences, early)?.id).toBe('A');
        const later = indexLearnerVocab([learning('self'), learning('a1', 150), learning('a2', 150), learning('b1', 5), learning('b2', 5)]);
        expect(pickSentenceForVocab('self', sentences, later)?.id).toBe('A');

        // a1 fills its first loop: it no longer counts, A drops to one target, B takes over.
        const rotated = indexLearnerVocab([learning('self'), learning('a1', SOFT_CAP), learning('a2', 150), learning('b1', 5), learning('b2', 5)]);
        expect(pickSentenceForVocab('self', sentences, rotated)?.id).toBe('B');
    });

    it('returns null for no sentences', () => {
        expect(pickSentenceForVocab('self', [], indexLearnerVocab([]))).toBeNull();
    });
});
