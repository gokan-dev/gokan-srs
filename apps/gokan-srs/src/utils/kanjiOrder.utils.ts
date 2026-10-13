import type { FrequencyIndex, KanjiOrderList } from '@gokan/dataset-schema';

/**
 * The words each step of a kanji order unlocks: step -> vocab ids, the shape of the dataset's
 * `index/kklc.json`, for any order. Step N is the Nth kanji of the order.
 */
export type KanjiStepIndex = Record<number, string[]>;

/**
 * A word comes in at the step of its last kanji in the order, the rule the dataset applies to
 * KKLC. A word with a kanji the order does not teach, with no kanji, or learned in kana is never
 * unlocked: the kanji-driven order leaves it to the others. Within a step, most frequent first.
 */
export function kanjiStepIndex(frequency: FrequencyIndex, order: KanjiOrderList): KanjiStepIndex {
    const position = new Map(order.map((kanji, index) => [kanji, index + 1]));
    const index: KanjiStepIndex = {};
    for (const entry of frequency) {
        if (entry.usuallyKana || entry.containedKanji.length === 0) continue;
        const steps = entry.containedKanji.map(kanji => position.get(kanji));
        if (steps.some(step => step === undefined)) continue;
        const step = Math.max(...steps.map(step => step ?? 0));
        (index[step] ??= []).push(entry.id);
    }
    return index;
}

/** The kanji the next step teaches, for a learner `step` kanji into the order; null at its end. */
export function nextKanjiStep(order: KanjiOrderList, step: number): { step: number; kanjis: string[] } | null {
    const kanji = order[step];
    return kanji === undefined ? null : { step: step + 1, kanjis: [kanji] };
}
