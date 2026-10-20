import { describe, expect, it } from 'vitest';
import { followsCountChange } from './kanjiGrid.utils';

describe('followsCountChange', () => {
    it('moves the grid on a count change only when asked to follow the count', () => {
        expect(followsCountChange(10, 20, true)).toBe(true);
        expect(followsCountChange(10, 20, false)).toBe(false);
    });

    it('stays put on the first run and when the count did not change', () => {
        expect(followsCountChange(null, 20, true)).toBe(false);
        expect(followsCountChange(20, 20, true)).toBe(false);
    });
});
