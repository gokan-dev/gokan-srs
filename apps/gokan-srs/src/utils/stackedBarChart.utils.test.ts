import { describe, expect, it } from 'vitest';
import { segmentHeightPercent, stackedBarDomOrder } from './stackedBarChart.utils';

describe('stackedBarDomOrder', () => {
    it('reverses bottom-to-top order to DOM order, so flex-col + justify-end anchors the first segment to the baseline', () => {
        expect(stackedBarDomOrder(['correct', 'incorrect'])).toEqual(['incorrect', 'correct']);
        expect(stackedBarDomOrder(['reading', 'meaning', 'production'])).toEqual(['production', 'meaning', 'reading']);
    });

    it('does not mutate its input', () => {
        const input = ['a', 'b'];
        stackedBarDomOrder(input);
        expect(input).toEqual(['a', 'b']);
    });
});

describe('segmentHeightPercent', () => {
    it('scales a value against the max', () => {
        expect(segmentHeightPercent(5, 10)).toBe(50);
        expect(segmentHeightPercent(10, 10)).toBe(100);
    });

    it('is zero when the max is zero or negative', () => {
        expect(segmentHeightPercent(5, 0)).toBe(0);
        expect(segmentHeightPercent(5, -1)).toBe(0);
    });

    it('clamps to 100 when a value exceeds the max', () => {
        expect(segmentHeightPercent(15, 10)).toBe(100);
    });
});
