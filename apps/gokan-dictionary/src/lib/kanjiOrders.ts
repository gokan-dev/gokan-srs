// The kanji learning order pages (issue #147): each order cut into ranges of 100 steps, and the
// words each step unlocks. Which words a step unlocks is never decided here: `kanjiStepIndex`
// (@gokan/dataset-schema) is the rule the app's kanji-driven order follows too.

import { unlockStep, type KanjiOrder, type KanjiOrderList, type KanjiStepIndex } from '@gokan/dataset-schema';

/**
 * The language of an order's prose name (`searchName`), for a sentence that names it: every one is
 * English but Maniette's, a French title ("Les Kanjis dans la tête"). The dictionary's prose alone
 * needs it, so it lives here, not in ORDER_INFO.
 */
export function orderNameLang(order: Pick<KanjiOrder, 'id'>): 'en' | 'fr' {
    return order.id === 'maniette' ? 'fr' : 'en';
}

/** Steps on one range page. */
export const KANJI_RANGE_SIZE = 100;

/**
 * Words listed under each kanji of a range page, the most frequent first. Late in an order a range
 * of 100 kanji unlocks over 3,000 words; a learner at step 340 wants the useful words of that step,
 * and the kanji's own page lists every word with it. This cap is what keeps a range page within
 * its budget (`kanjiOrderPage`, lib/budgets.ts).
 */
export const WORDS_PER_KANJI = 5;

/** Whether a range page leaves out some of a step's words, so its intro says how many it shows. */
export function anyStepCapped(steps: readonly { words: readonly unknown[]; total: number }[]): boolean {
    return steps.some(step => step.total > step.words.length);
}

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

/** An order, with each of its kanji by step (`orderPositions`). */
export interface PositionedOrder {
    order: KanjiOrder;
    positions: ReadonlyMap<string, number>;
}

/** Where a word or a kanji sits in an order: the step it comes in at. */
export interface OrderStep {
    order: KanjiOrder;
    step: number;
}

/**
 * The step a word comes in at (`unlockStep`), in the first of `orders` that teaches every kanji of
 * it: given in KANJI_ORDERS order, KKLC (the app's default order) when it can, else the most
 * followed order that can. None for a word no order unlocks (no kanji, learned in kana).
 */
export function wordOrderStep(word: { containedKanji: readonly string[]; usuallyKana?: boolean }, orders: readonly PositionedOrder[]): OrderStep | null {
    for (const { order, positions } of orders) {
        const step = unlockStep(word, positions);
        if (step !== undefined) return { order, step };
    }
    return null;
}

/** A kanji's step in the first of `orders` that teaches it, as `wordOrderStep`; none when no order does. */
export function kanjiOrderStep(character: string, orders: readonly PositionedOrder[]): OrderStep | null {
    for (const { order, positions } of orders) {
        const step = positions.get(character);
        if (step !== undefined) return { order, step };
    }
    return null;
}

/**
 * How many words a learner can read on reaching each step: entry N counts the words steps 1 to N
 * unlock (entry 0 is none), so a kanji page says how many words knowing the order that far gives.
 */
export function unlockedThrough(unlocked: KanjiStepIndex, orderLength: number): number[] {
    const totals = [0];
    for (let step = 1; step <= orderLength; step++) totals.push(totals[step - 1] + (unlocked[step]?.length ?? 0));
    return totals;
}
