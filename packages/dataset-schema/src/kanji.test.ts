import { describe, it, expect } from 'vitest';
import { KANJI_ORDERS, isKanjiOrderId, kanjiBookPositions, kanjiGradeLabel, kanjiOrder, kunReadingLabel, supportedOrdersList } from './kanji';

describe('KANJI_ORDERS', () => {
    it('lists every order once, KKLC and RTK first', () => {
        const ids = KANJI_ORDERS.map(order => order.id);
        expect(ids.slice(0, 2)).toEqual(['kklc', 'rtk']);
        expect(new Set(ids).size).toBe(ids.length);
        expect(kanjiOrder('rtk').label).toBe('RTK');
    });

    it('recognises a stored order id, and nothing else', () => {
        expect(isKanjiOrderId('rtk')).toBe(true);
        expect(isKanjiOrderId('essentialKanji')).toBe(false);
        expect(isKanjiOrderId('toString')).toBe(false);
        expect(isKanjiOrderId(undefined)).toBe(false);
    });

    it('describes every order without parentheses, so the order pages\' "label (description)" never nests', () => {
        for (const order of KANJI_ORDERS) expect(order.description).not.toContain('(');
    });
});

describe('supportedOrdersList', () => {
    it('names every order once, where its name first appears in KANJI_ORDERS', () => {
        expect(`${supportedOrdersList()}.`).toBe(
            'KKLC, Remembering the Kanji in any edition, JLPT and frequency order, Kanji & Kana (the school-grade order), '
            + 'Kanji in Context, Henshall, the White Rabbit and Tuttle cards, and Les Kanjis dans la tête.',
        );
        // rtk and rtkLegacy are not adjacent: the shared name is said at the first of them only.
        const names = KANJI_ORDERS.map(order => order.listName);
        expect(supportedOrdersList().split(names[1]).length).toBe(2);
        expect(new Set(names).size).toBe(8);
    });
});

describe('kanjiBookPositions', () => {
    it('names each book that teaches the kanji, leaving the JLPT level out', () => {
        expect(kanjiBookPositions({ steps: { kklc: 99, rtk: 346, jlpt: 5, essentialKanji: 66 } })).toStrictEqual([
            { book: 'kklc', name: 'Kodansha Kanji Learner\'s Course', label: 'KKLC', position: 99 },
            { book: 'rtk', name: 'Remembering the Kanji', label: 'RTK', position: 346 },
            { book: 'essentialKanji', name: 'Essential Kanji', position: 66 },
        ]);
    });

    it('gives a book its order label only when the label says something the title does not', () => {
        const [inContext, flashcards] = kanjiBookPositions({ steps: { kanjiInContext: 1, kanjiFlashcards: 44 } });
        expect(inContext).toStrictEqual({ book: 'kanjiInContext', name: 'Kanji in Context', position: 1 });
        expect(flashcards.label).toBe('White Rabbit cards');
    });

    it('spells a book as its order pages do', () => {
        const [legacy] = kanjiBookPositions({ steps: { rtkLegacy: 1 } });
        expect(legacy.name).toBe(kanjiOrder('rtkLegacy').description);
        expect(legacy.name).toBe('Remembering the Kanji, 1st to 5th editions');
        expect(kanjiOrder('rtkLegacy').searchName).toContain('editions');
    });
});

describe('kanjiGradeLabel', () => {
    it('names primary school grades, the rest of the jōyō and the name kanji', () => {
        expect(kanjiGradeLabel(2)).toBe('Grade 2');
        expect(kanjiGradeLabel(8)).toBe('Jōyō, secondary school');
        expect(kanjiGradeLabel(9)).toBe('Jinmeiyō (names)');
    });
});

describe('kunReadingLabel', () => {
    it('puts the okurigana in parentheses, keeping an affix dash', () => {
        expect(kunReadingLabel('まな.ぶ')).toBe('まな(ぶ)');
        expect(kunReadingLabel('うみ')).toBe('うみ');
        expect(kunReadingLabel('-がく')).toBe('-がく');
    });
});
