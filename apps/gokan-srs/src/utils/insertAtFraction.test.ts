import { describe, expect, it } from 'vitest';
import { insertAtFraction } from './insertAtFraction';

describe('insertAtFraction', () => {
    const items = ['a', 'b', 'c'];

    it('inserts at the start, the middle and the end', () => {
        expect(insertAtFraction(items, 'x', 0)).toEqual(['x', 'a', 'b', 'c']);
        expect(insertAtFraction(items, 'x', 0.5)).toEqual(['a', 'b', 'x', 'c']);
        expect(insertAtFraction(items, 'x', 1)).toEqual(['a', 'b', 'c', 'x']);
    });

    it('clamps a fraction outside 0..1 and leaves the input untouched', () => {
        expect(insertAtFraction(items, 'x', -2)).toEqual(['x', 'a', 'b', 'c']);
        expect(insertAtFraction(items, 'x', 9)).toEqual(['a', 'b', 'c', 'x']);
        expect(items).toEqual(['a', 'b', 'c']);
    });

    it('handles an empty list', () => {
        expect(insertAtFraction([], 'x', 0.7)).toEqual(['x']);
    });
});
