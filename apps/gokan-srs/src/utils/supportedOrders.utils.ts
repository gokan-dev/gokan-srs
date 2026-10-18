import { KANJI_ORDERS, type KanjiOrderId } from '@gokan/dataset-schema';

/**
 * How the welcome screen names each order, in a sentence rather than a picker. Orders sharing a
 * name are said once (both RTKs, both card sets). A Record, so a new order fails to compile until
 * it is named here: the welcome screen can never promise fewer orders than the picker offers.
 */
const ORDER_NAMES: Record<KanjiOrderId, string> = {
    kklc: 'KKLC',
    rtk: 'Remembering the Kanji (any edition)',
    rtkLegacy: 'Remembering the Kanji (any edition)',
    jlpt: 'JLPT and frequency order',
    frequency: 'JLPT and frequency order',
    kanjiKana: 'the school-grade order',
    kanjiInContext: 'Kanji in Context',
    henshall: 'Henshall',
    kanjiFlashcards: 'the White Rabbit and Tuttle cards',
    tuttleCards: 'the White Rabbit and Tuttle cards',
    maniette: 'Les Kanjis dans la tête',
};

/** Every order a learner can follow, as one English list in `KANJI_ORDERS` order: "KKLC, ..., and Les Kanjis dans la tête". */
export function supportedOrdersList(): string {
    const names = [...new Set(KANJI_ORDERS.map(order => ORDER_NAMES[order.id]))];
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
