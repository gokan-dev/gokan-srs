import { describe, it, expect } from 'vitest';
import { kanjiRanges, rangeOfStep } from './kanjiOrders';

describe('rangeOfStep', () => {
    it('puts a step in its range of 100, the last range cut at the order end', () => {
        expect(rangeOfStep(1, 2300)).toEqual({ first: 1, last: 100 });
        expect(rangeOfStep(100, 2300)).toEqual({ first: 1, last: 100 });
        expect(rangeOfStep(101, 2300)).toEqual({ first: 101, last: 200 });
        expect(rangeOfStep(1945, 1945)).toEqual({ first: 1901, last: 1945 });
    });
});

describe('kanjiRanges', () => {
    const ORDER = ['一', '日', '学', '生', '海'];

    it('cuts the order into ranges, each step with the words it unlocks', () => {
        const ranges = kanjiRanges(ORDER, { 2: ['ichinichi', 'nichi'], 4: ['gakusei'] }, 2);
        expect(ranges.map(range => [range.first, range.last, range.wordCount])).toEqual([[1, 2, 2], [3, 4, 1], [5, 5, 0]]);
        expect(ranges[0].steps).toEqual([
            { step: 1, character: '一', wordIds: [] },
            { step: 2, character: '日', wordIds: ['ichinichi', 'nichi'] },
        ]);
        expect(ranges[2].steps).toEqual([{ step: 5, character: '海', wordIds: [] }]);
    });

    it('agrees with rangeOfStep about where every step falls', () => {
        for (const range of kanjiRanges(ORDER, {}, 2)) {
            for (const { step } of range.steps) expect(rangeOfStep(step, ORDER.length, 2)).toEqual({ first: range.first, last: range.last });
        }
    });

    it('has no range for an empty order', () => {
        expect(kanjiRanges([], {})).toEqual([]);
    });
});
