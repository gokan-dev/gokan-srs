import { describe, expect, it } from 'vitest';
import { redrawOnIndexChange } from './searchRedraw';

describe('redrawOnIndexChange', () => {
    it('redraws a list the reader has not moved in: not scrolled, its first page drawn', () => {
        expect(redrawOnIndexChange({ drawn: 30, pageSize: 30, scrolled: 0 })).toBe(true);
        expect(redrawOnIndexChange({ drawn: 12, pageSize: 30, scrolled: 0 })).toBe(true);
    });

    it('draws when nothing is drawn yet (the core arriving)', () => {
        expect(redrawOnIndexChange({ drawn: 0, pageSize: 30, scrolled: 0 })).toBe(true);
    });

    it('keeps a list scrolled, or drawn past its first page', () => {
        expect(redrawOnIndexChange({ drawn: 30, pageSize: 30, scrolled: 120 })).toBe(false);
        expect(redrawOnIndexChange({ drawn: 60, pageSize: 30, scrolled: 0 })).toBe(false);
        expect(redrawOnIndexChange({ drawn: 100, pageSize: 50, scrolled: 2400 })).toBe(false);
    });
});
