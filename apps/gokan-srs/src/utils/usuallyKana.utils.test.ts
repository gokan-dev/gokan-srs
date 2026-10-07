import { describe, expect, it } from 'vitest';
import { orderIncludesUsuallyKana, usuallyKanaBudget, usuallyKanaPacer } from './usuallyKana.utils';

describe('orderIncludesUsuallyKana', () => {
    it('leaves words learned in kana out of the kanji-driven orders only', () => {
        expect(orderIncludesUsuallyKana('kklc')).toBe(false);
        expect(orderIncludesUsuallyKana('kanji_coverage')).toBe(false);
        expect(orderIncludesUsuallyKana('frequency')).toBe(true);
        expect(orderIncludesUsuallyKana('jlpt')).toBe(true);
    });
});

describe('usuallyKanaPacer', () => {
    it('admits every other word, and words learned in kana up to the budget', () => {
        const pacer = usuallyKanaPacer(2);
        const admitted = ['この', '人', 'その', 'あの', '山', 'ここ']
            .map((id, i) => ({ id, ...(i === 1 || i === 4 ? {} : { usuallyKana: true as const }) }))
            .filter(e => pacer.admit(e))
            .map(e => e.id);
        expect(admitted).toEqual(['この', '人', 'その', '山']);
        expect(pacer.deferred(5)).toEqual(['あの', 'ここ']);
        expect(pacer.deferred(1)).toEqual(['あの']);
    });

    it('defers every word learned in kana once the budget is spent, each once', () => {
        const pacer = usuallyKanaPacer(0);
        expect(pacer.admit({ id: 'この', usuallyKana: true })).toBe(false);
        expect(pacer.admit({ id: '人' })).toBe(true);
        // Met again by the JLPT order's frequency fallback.
        expect(pacer.admit({ id: 'この', usuallyKana: true })).toBe(false);
        expect(pacer.deferred(5)).toEqual(['この']);
    });
});

describe('usuallyKanaBudget', () => {
    it('subtracts what the session introduced and what already waits among the candidates', () => {
        expect(usuallyKanaBudget(2, 0, [])).toBe(2);
        expect(usuallyKanaBudget(2, 1, [{ usuallyKana: true }, {}])).toBe(0);
        expect(usuallyKanaBudget(2, 3, [])).toBe(0);
    });
});
