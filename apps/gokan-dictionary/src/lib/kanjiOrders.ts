// The kanji learning order pages (issue #147): each order cut into ranges of 100 steps, and the
// words each step unlocks. Which words a step unlocks is never decided here: `kanjiStepIndex`
// (@gokan/dataset-schema) is the rule the app's kanji-driven order follows too.

import type { KanjiOrderList, KanjiStepIndex } from '@gokan/dataset-schema';

/** Steps on one range page. */
export const KANJI_RANGE_SIZE = 100;

/**
 * Words listed under each kanji of a range page, the most frequent first. Late in an order a range
 * of 100 kanji unlocks over 3,000 words; a learner at step 340 wants the useful words of that step,
 * and the kanji's own page lists every word with it. This cap is what keeps a range page within
 * its budget (`kanjiOrderPage`, lib/budgets.ts).
 */
export const WORDS_PER_KANJI = 5;

/** Steps `first` to `last` of an order, both included, 1-based. */
export interface StepRange {
    first: number;
    last: number;
}

/** One kanji of a range and the words its step unlocks (every one: the page shows the head). */
export interface RangeStep {
    step: number;
    character: string;
    wordIds: string[];
}

export interface KanjiRange extends StepRange {
    steps: RangeStep[];
    /** Every word the range's steps unlock. */
    wordCount: number;
}

/** The range of `size` steps a step falls in, the last one cut short at the order's end. */
export function rangeOfStep(step: number, orderLength: number, size = KANJI_RANGE_SIZE): StepRange {
    const first = Math.floor((step - 1) / size) * size + 1;
    return { first, last: Math.min(first + size - 1, orderLength) };
}

/** An order in consecutive ranges of `size` steps, each with the words its steps unlock. */
export function kanjiRanges(order: KanjiOrderList, unlocked: KanjiStepIndex, size = KANJI_RANGE_SIZE): KanjiRange[] {
    const ranges: KanjiRange[] = [];
    for (let first = 1; first <= order.length; first += size) {
        const { last } = rangeOfStep(first, order.length, size);
        const steps = order.slice(first - 1, last).map((character, index) => ({
            step: first + index,
            character,
            wordIds: unlocked[first + index] ?? [],
        }));
        ranges.push({ first, last, steps, wordCount: steps.reduce((sum, step) => sum + step.wordIds.length, 0) });
    }
    return ranges;
}
