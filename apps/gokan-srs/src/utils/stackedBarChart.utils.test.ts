import { describe, expect, it } from 'vitest';
import { axisTicks, segmentHeightPercent, showsLabelWhenNarrow, stackedBarDomOrder, tooltipAnchor } from './stackedBarChart.utils';

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

describe('axisTicks', () => {
    it('labels the max, a whole midline and 0', () => {
        expect(axisTicks(40)).toEqual([40, 20, 0]);
        expect(axisTicks(3)).toEqual([3, 2, 0]);
    });

    it('never repeats a label on a tiny scale', () => {
        expect(axisTicks(0)).toEqual([1, 0]);
        expect(axisTicks(1)).toEqual([1, 0]);
    });
});

describe('showsLabelWhenNarrow', () => {
    it('shows every label of a short chart', () => {
        expect([0, 1, 2, 3, 4, 5, 6].every(i => showsLabelWhenNarrow(i, 7))).toBe(true);
    });

    it('shows every other label of a long chart, always including the last', () => {
        expect(showsLabelWhenNarrow(13, 14)).toBe(true);
        expect(showsLabelWhenNarrow(12, 14)).toBe(false);
        expect(showsLabelWhenNarrow(11, 14)).toBe(true);
    });

    it('shows every fifth label of a month, counting back from the last', () => {
        const shown = Array.from({ length: 30 }, (_, i) => i).filter(i => showsLabelWhenNarrow(i, 30));
        expect(shown).toEqual([4, 9, 14, 19, 24, 29]);
    });
});

describe('tooltipAnchor', () => {
    it('opens inward from the outer third of bars, centred in the middle', () => {
        expect(tooltipAnchor(0, 30)).toBe('start');
        expect(tooltipAnchor(9, 30)).toBe('start');
        expect(tooltipAnchor(10, 30)).toBe('center');
        expect(tooltipAnchor(19, 30)).toBe('center');
        expect(tooltipAnchor(20, 30)).toBe('end');
        expect(tooltipAnchor(29, 30)).toBe('end');
    });

    it('anchors the end bars of a week too, and centres a lone bar', () => {
        expect(tooltipAnchor(0, 7)).toBe('start');
        expect(tooltipAnchor(3, 7)).toBe('center');
        expect(tooltipAnchor(6, 7)).toBe('end');
        expect(tooltipAnchor(0, 1)).toBe('center');
    });
});
