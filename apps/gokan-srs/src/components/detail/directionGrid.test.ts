import { describe, expect, it } from 'vitest';
import { directionGridColumns } from './directionGrid';

describe('directionGridColumns', () => {
    it('gives a column per direction, up to three', () => {
        expect([1, 2, 3, 4].map(directionGridColumns)).toEqual(['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-3']);
    });

    it('gives one column, not undefined, for no direction', () => {
        expect(directionGridColumns(0)).toBe('grid-cols-1');
    });
});
