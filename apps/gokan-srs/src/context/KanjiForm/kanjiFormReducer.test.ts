import { describe, expect, it } from "vitest";
import { countOf, initialKanjiForm, kanjiFormReducer, knownKanjiOf, knownPrefix, type KanjiFormAction, type KanjiFormModel } from "./kanjiFormReducer";

const KKLC = ['日', '一', '国', '人', '年'];
const RTK = ['一', '二', '三', '口', '日'];

const run = (state: KanjiFormModel, ...actions: KanjiFormAction[]) => actions.reduce(kanjiFormReducer, state);
const known = (state: KanjiFormModel, list: readonly string[]) => [...knownKanjiOf(state, list)].sort();
const sorted = (...kanji: string[]) => [...kanji].sort();
/** The profile page: opened on a stored set. */
const stored = (method: 'kklc' | 'rtk', count: number, ...kanji: string[]) => initialKanjiForm(method, count, new Set(kanji));

describe('kanjiFormReducer', () => {
    it('starts setup at the first N of the default order, before anything is chosen', () => {
        const state = initialKanjiForm('kklc', 2);
        expect(known(state, KKLC)).toEqual(sorted('日', '一'));
        expect(knownKanjiOf(state, null).size).toBe(0);
    });

    it('carries the setup default count over to an order picked before anything is marked', () => {
        const state = run(initialKanjiForm('kklc', 2), { type: 'SET_METHOD', method: 'rtk', list: KKLC });
        expect(countOf(state, RTK)).toBe(2);
        expect(known(state, RTK)).toEqual(sorted('一', '二'));
    });

    it('lowers the setup count freely: the default seed is not a stored set', () => {
        const state = run(initialKanjiForm('kklc', 4), { type: 'SET_COUNT', count: 1, list: KKLC });
        expect(known(state, KKLC)).toEqual(['日']);
    });

    it('opens the profile on the stored set, not on the first N of the order', () => {
        expect(known(stored('kklc', 2, '日', '一', '口'), KKLC)).toEqual(sorted('日', '一', '口'));
    });

    it('shows 0 after a switch and keeps the set', () => {
        const state = run(stored('kklc', 3, '日', '一', '国'), { type: 'SET_METHOD', method: 'rtk', list: KKLC });
        expect(state.method).toBe('rtk');
        expect(countOf(state, RTK)).toBe(0);
        expect(known(state, RTK)).toEqual(sorted('日', '一', '国'));
    });

    it('adds an order\'s first N to the set instead of replacing it', () => {
        const state = run(
            stored('kklc', 0),
            { type: 'SET_COUNT', count: 3, list: KKLC },
            { type: 'SET_METHOD', method: 'rtk', list: KKLC },
            { type: 'SET_COUNT', count: 3, list: RTK },
        );
        expect(known(state, RTK)).toEqual(sorted('日', '一', '国', '二', '三'));
        expect(state.count).toBe(3);
    });

    it('restores the set exactly when a raise is lowered back', () => {
        const before = stored('kklc', 3, '日', '一', '国');
        const switched = run(before, { type: 'SET_METHOD', method: 'rtk', list: KKLC });
        const state = run(switched, { type: 'SET_COUNT', count: 5, list: RTK }, { type: 'SET_COUNT', count: 0, list: RTK });
        expect(known(state, RTK)).toEqual(known(before, RTK));
    });

    it('never lowers away a stored kanji or one known from another order', () => {
        const state = run(
            stored('kklc', 3, '日', '一', '国'),
            { type: 'SET_COUNT', count: 4, list: KKLC },
            { type: 'SET_METHOD', method: 'rtk', list: KKLC },
            { type: 'SET_COUNT', count: 5, list: RTK },
            { type: 'SET_COUNT', count: 0, list: RTK },
        );
        // 人 came from this visit's KKLC raise, before the switch: it is known now, so it stays.
        expect(known(state, RTK)).toEqual(sorted('日', '一', '国', '人'));
        // After a reload nothing was raised, so lowering removes nothing.
        const reloaded = run(stored('rtk', 4, '一', '二', '三', '口'), { type: 'SET_COUNT', count: 1, list: RTK });
        expect(known(reloaded, RTK)).toEqual(sorted('一', '二', '三', '口'));
        expect(reloaded.count).toBe(1);
    });

    it('lowering after a raise removes only what that raise added', () => {
        const state = run(
            stored('rtk', 0, '二'),
            { type: 'SET_COUNT', count: 4, list: RTK },
            { type: 'SET_COUNT', count: 1, list: RTK },
        );
        // 二 was known before the raise; 三 and 口 were added by it.
        expect(known(state, RTK)).toEqual(sorted('一', '二'));
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

    it('saves the known prefix as the step, whatever the count input shows', () => {
        const state = run(stored('kklc', 3, '日', '一', '国'), { type: 'SET_METHOD', method: 'rtk', list: KKLC });
        // The input is 0, but one RTK kanji (一) leads the known set: new words follow that.
        expect(countOf(state, RTK)).toBe(0);
        expect(knownPrefix(RTK, knownKanjiOf(state, RTK))).toBe(1);
    });

    it('ignores count changes while the order\'s list is loading', () => {
        const state = initialKanjiForm('kklc', 2);
        expect(kanjiFormReducer(state, { type: 'SET_COUNT', count: 4, list: null })).toBe(state);
    });

    it('caps the count at the end of a shorter list', () => {
        const state = run(stored('kklc', 0), { type: 'SET_COUNT', count: 99, list: KKLC });
        expect(state.count).toBe(KKLC.length);
        expect(known(state, KKLC)).toEqual(sorted(...KKLC));
    });

    it('resets to the current order\'s first N and drops individual marks', () => {
        const state = run(
            stored('kklc', 2, '日', '一', '二', '三'),
            { type: 'TOGGLE', kanji: '年', list: KKLC },
            { type: 'RESET', list: KKLC },
        );
        expect(known(state, KKLC)).toEqual(sorted('日', '一'));
        expect(state.marked.size).toBe(0);
    });

    it('empties the set on a reset right after a switch, where the count is 0', () => {
        const state = run(stored('kklc', 3, '日', '一', '国'), { type: 'SET_METHOD', method: 'rtk', list: KKLC }, { type: 'RESET', list: RTK });
        expect(knownKanjiOf(state, RTK).size).toBe(0);
    });

    it('returns the same set object while nothing changes, so the editor reports no spurious update', () => {
        const state = stored('kklc', 2, '日');
        expect(knownKanjiOf(state, KKLC)).toBe(knownKanjiOf(state, KKLC));
    });
});
