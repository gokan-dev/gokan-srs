import { describe, it, expect } from 'vitest';
import { buildWordOrderContext, computeUncoveredKanji, isLearnableNow, sortWords } from './wordOrder.utils';
import type { LearnerOrder } from './wordOrder.utils';
import type { MediaWordCount } from '@gokan/dataset-schema';

// Frequency order: a (most frequent), b, c, d.
const context = buildWordOrderContext(
    [
        { id: 'a', containedKanji: ['日'] },
        { id: 'b', containedKanji: ['月'] },
        { id: 'c', containedKanji: ['日', '本'] },
        { id: 'd', containedKanji: ['火'] },
    ],
    { 5: [{ id: 'c', containedKanji: [] }], 3: [{ id: 'a', containedKanji: [] }] },
    { 1: ['d'], 2: ['b'], 3: ['a', 'c'] }
);

function learner(overrides: Partial<LearnerOrder> = {}): LearnerOrder {
    return {
        order: 'frequency',
        knownKanji: new Set(['日', '月', '本', '火']),
        kklcStep: 100,
        ignoreKnownKanji: false,
        uncoveredKanji: new Set(),
        ...overrides,
    };
}

// Most used here: d (9), c (5), b (2), a (1).
const words: MediaWordCount[] = [['a', 1], ['b', 2], ['c', 5], ['d', 9]];
const ids = (list: MediaWordCount[]) => list.map(([id]) => id);

describe('sortWords', () => {
    it('orders by use in the episode', () => {
        expect(ids(sortWords(words, 'occurrences', context, learner()))).toEqual(['d', 'c', 'b', 'a']);
    });

    it('orders by general frequency', () => {
        expect(ids(sortWords(words, 'frequency', context, learner()))).toEqual(['a', 'b', 'c', 'd']);
    });

    it('orders by JLPT level, N5 first, words without a level last', () => {
        expect(ids(sortWords(words, 'jlpt', context, learner()))).toEqual(['c', 'a', 'b', 'd']);
    });

    it('orders by KKLC step, frequency within a step', () => {
        expect(ids(sortWords(words, 'kklc', context, learner()))).toEqual(['d', 'b', 'a', 'c']);
    });

    it('falls back to use in the episode while the indexes are loading', () => {
        expect(ids(sortWords(words, 'frequency', null, null))).toEqual(['d', 'c', 'b', 'a']);
    });

    describe("the learner's own order", () => {
        it('follows their learning order', () => {
            expect(ids(sortWords(words, 'yours', context, learner({ order: 'jlpt' })))).toEqual(['c', 'a', 'b', 'd']);
            expect(ids(sortWords(words, 'yours', context, learner({ order: 'kklc' })))).toEqual(['d', 'b', 'a', 'c']);
        });

        it('puts words whose kanji they know first', () => {
            const sorted = sortWords(words, 'yours', context, learner({ knownKanji: new Set(['月', '火']) }));
            expect(ids(sorted)).toEqual(['b', 'd', 'a', 'c']);
        });

        it('does not hold back unknown kanji when they turned that requirement off', () => {
            const sorted = sortWords(words, 'yours', context, learner({ knownKanji: new Set(), ignoreKnownKanji: true }));
            expect(ids(sorted)).toEqual(['a', 'b', 'c', 'd']);
        });

        it('favours words covering under-covered kanji under the kanji coverage order', () => {
            const sorted = sortWords(words, 'yours', context, learner({ order: 'kanji_coverage', uncoveredKanji: new Set(['火']) }));
            expect(ids(sorted)[0]).toBe('d');
        });
    });
});

describe('isLearnableNow', () => {
    it('is gated by step under the KKLC order', () => {
        expect(isLearnableNow('a', context, learner({ order: 'kklc', kklcStep: 2 }))).toBe(false);
        expect(isLearnableNow('b', context, learner({ order: 'kklc', kklcStep: 2 }))).toBe(true);
    });

    it('needs every kanji known otherwise, and an unindexed word is not learnable', () => {
        expect(isLearnableNow('c', context, learner({ knownKanji: new Set(['日']) }))).toBe(false);
        expect(isLearnableNow('a', context, learner({ knownKanji: new Set(['日']) }))).toBe(true);
        expect(isLearnableNow('zzz', context, learner())).toBe(false);
    });
});

describe('computeUncoveredKanji', () => {
    it('lists known kanji used by fewer of the learner\'s words than the target', () => {
        const uncovered = computeUncoveredKanji(['a', 'c'], new Set(['日', '本', '月']), context.kanjiOf, 2);
        expect([...uncovered].sort()).toEqual(['月', '本']);
    });
});
