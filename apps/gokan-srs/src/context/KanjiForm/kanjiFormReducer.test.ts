import { describe, expect, it } from "vitest";
import { countOf, initialKanjiForm, kanjiFormReducer, knownKanjiOf, type KanjiFormAction, type KanjiFormModel } from "./kanjiFormReducer";

const KKLC = ['日', '一', '国', '人', '年'];
const RTK = ['一', '二', '三', '口', '日'];

const run = (state: KanjiFormModel, ...actions: KanjiFormAction[]) => actions.reduce(kanjiFormReducer, state);
const known = (state: KanjiFormModel, list: readonly string[]) => [...knownKanjiOf(state, list)].sort();
const sorted = (...kanji: string[]) => [...kanji].sort();

describe('kanjiFormReducer', () => {
    it('starts setup at the first N of the default order, before anything is chosen', () => {
        const state = initialKanjiForm('kklc', 2);
        expect(known(state, KKLC)).toEqual(sorted('日', '一'));
        expect(knownKanjiOf(state, null).size).toBe(0);
    });

    it('opens the profile on the stored set, not on the first N of the order', () => {
        const state = initialKanjiForm('kklc', 2, new Set(['日', '一', '口']));
        expect(known(state, KKLC)).toEqual(sorted('日', '一', '口'));
    });

    it('keeps the known set when the order changes, and counts from where it already reaches', () => {
        const state = run(initialKanjiForm('kklc', 3), { type: 'SET_METHOD', method: 'rtk', list: KKLC });
        expect(state.method).toBe('rtk');
        expect(known(state, RTK)).toEqual(sorted('日', '一', '国'));
        // 一 is known, 二 is not: one RTK kanji in.
        expect(countOf(state, RTK, knownKanjiOf(state, RTK))).toBe(1);
    });

    it('adds an order\'s first N to the set instead of replacing it', () => {
        const state = run(
            initialKanjiForm('kklc', 0),
            { type: 'SET_COUNT', count: 3, list: KKLC },
            { type: 'SET_METHOD', method: 'rtk', list: KKLC },
            { type: 'SET_COUNT', count: 3, list: RTK },
        );
        expect(known(state, RTK)).toEqual(sorted('日', '一', '国', '二', '三'));
        expect(state.count).toBe(3);
    });

    it('lowering the count takes back only that stretch of the current order', () => {
        const state = run(
            initialKanjiForm('rtk', 4, new Set(['一', '二', '三', '口', '国'])),
            { type: 'SET_COUNT', count: 2, list: RTK },
        );
        expect(known(state, RTK)).toEqual(sorted('一', '二', '国'));
    });

    it('keeps individual marks across count and order changes', () => {
        const state = run(
            initialKanjiForm('kklc', 2),
            { type: 'TOGGLE', kanji: '年', list: KKLC },
            { type: 'TOGGLE', kanji: '一', list: KKLC },
            { type: 'SET_COUNT', count: 0, list: KKLC },
            { type: 'SET_COUNT', count: 4, list: KKLC },
            { type: 'SET_METHOD', method: 'rtk', list: KKLC },
            { type: 'SET_COUNT', count: 5, list: RTK },
        );
        expect(known(state, RTK)).toEqual(sorted('日', '国', '人', '年', '二', '三', '口'));
    });

    it('pins a count that follows the known prefix when a kanji is marked', () => {
        const switched = run(initialKanjiForm('rtk', 3), { type: 'SET_METHOD', method: 'kklc', list: RTK });
        const state = run(switched, { type: 'TOGGLE', kanji: '日', list: KKLC });
        expect(state.count).toBe(0);
        expect(countOf(state, KKLC, knownKanjiOf(state, KKLC))).toBe(0);
    });

    it('ignores count changes while the order\'s list is loading', () => {
        const state = initialKanjiForm('kklc', 2);
        expect(kanjiFormReducer(state, { type: 'SET_COUNT', count: 4, list: null })).toBe(state);
    });

    it('caps the count at the end of a shorter list', () => {
        const state = run(initialKanjiForm('kklc', 0), { type: 'SET_COUNT', count: 99, list: KKLC });
        expect(state.count).toBe(KKLC.length);
        expect(known(state, KKLC)).toEqual(sorted(...KKLC));
    });

    it('resets to the current order\'s first N and drops individual marks', () => {
        const state = run(
            initialKanjiForm('kklc', 2, new Set(['日', '一', '二', '三'])),
            { type: 'TOGGLE', kanji: '年', list: KKLC },
            { type: 'RESET', list: KKLC },
        );
        expect(known(state, KKLC)).toEqual(sorted('日', '一'));
        expect(state.marked.size).toBe(0);
    });

    it('returns the same set object while nothing changes, so the editor reports no spurious update', () => {
        const state = initialKanjiForm('kklc', 2, new Set(['日']));
        expect(knownKanjiOf(state, KKLC)).toBe(knownKanjiOf(state, KKLC));
    });
});
