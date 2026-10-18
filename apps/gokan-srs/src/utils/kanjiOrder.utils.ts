import type { KanjiOrderList } from '@gokan/dataset-schema';

/** The kanji the next step teaches, for a learner `step` kanji into the order; null at its end. */
export function nextKanjiStep(order: KanjiOrderList, step: number): { step: number; kanjis: string[] } | null {
    const kanji = order[step];
    return kanji === undefined ? null : { step: step + 1, kanjis: [kanji] };
}
