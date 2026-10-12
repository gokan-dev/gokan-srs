import { describe, expect, it } from 'vitest';
import { paginate } from './pagination';

describe('paginate', () => {
    it('splits a list into pages of the given size, the last one shorter', () => {
        expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('keeps a short list on one page', () => {
        expect(paginate([1, 2], 500)).toEqual([[1, 2]]);
    });

    it('gives an empty list one empty page', () => {
        expect(paginate([], 500)).toEqual([[]]);
    });
});
