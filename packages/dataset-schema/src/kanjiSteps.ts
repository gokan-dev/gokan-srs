import type { FrequencyIndex, KanjiOrderList } from './indexes';

/**
 * The words each step of a kanji order unlocks: step -> vocab ids, the shape of the dataset's
 * `index/kklc.json`, for any order. Step N is the Nth kanji of the order.
 */
export type KanjiStepIndex = Record<number, string[]>;

/** Each kanji of an order by its step (1-based), for `unlockStep`. */
export function orderPositions(order: KanjiOrderList): ReadonlyMap<string, number> {
    return new Map(order.map((kanji, index) => [kanji, index + 1]));
}

/**
 * The step of an order at which a word comes in: the step of its last kanji, the rule the dataset
 * applies to KKLC. None for a word with a kanji the order does not teach, with no kanji, or learned
 * in kana: the kanji-driven order leaves it to the others.
 */
export function unlockStep(word: { containedKanji: readonly string[]; usuallyKana?: boolean }, positions: ReadonlyMap<string, number>): number | undefined {
    if (word.usuallyKana || word.containedKanji.length === 0) return undefined;
    let last = 0;
    for (const kanji of word.containedKanji) {
        const step = positions.get(kanji);
        if (step === undefined) return undefined;
        last = Math.max(last, step);
    }
    return last;
}

/**
 * The words each step of an order unlocks (`unlockStep`), within a step most frequent first. One
 * copy for both apps, so the dictionary's order pages and the app's kanji-driven order can never
 * disagree about which words a step unlocks.
 */
export function kanjiStepIndex(frequency: FrequencyIndex, order: KanjiOrderList): KanjiStepIndex {
    const positions = orderPositions(order);
    const index: KanjiStepIndex = {};
    for (const entry of frequency) {
        const step = unlockStep(entry, positions);
        if (step !== undefined) (index[step] ??= []).push(entry.id);
    }
    return index;
}
