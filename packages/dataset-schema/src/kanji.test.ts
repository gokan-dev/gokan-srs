import { describe, it, expect } from 'vitest';
import { KANJI_ORDERS, isKanjiOrderId, kanjiBookPositions, kanjiGradeLabel, kanjiOrder, kunReadingLabel } from './kanji';

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
});

describe('kanjiBookPositions', () => {
    it('names each book that teaches the kanji, leaving the JLPT level out', () => {
        expect(kanjiBookPositions({ steps: { kklc: 99, rtk: 346, jlpt: 5, essentialKanji: 66 } })).toEqual([
            { book: 'kklc', name: 'Kodansha Kanji Learner\'s Course', position: 99 },
            { book: 'rtk', name: 'Remembering the Kanji', position: 346 },
            { book: 'essentialKanji', name: 'Essential Kanji', position: 66 },
        ]);
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
