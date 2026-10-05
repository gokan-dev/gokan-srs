import { describe, expect, it } from 'vitest';
import { numericEntries } from './records';

describe('numericEntries', () => {
    it('returns numeric keys with their values', () => {
        const record: Record<number, string[]> = { 5: ['a'], 4: ['b', 'c'] };
        expect(numericEntries(record).sort(([a], [b]) => a - b)).toEqual([[4, ['b', 'c']], [5, ['a']]]);
    });

    it('returns nothing for an empty record', () => {
        expect(numericEntries({})).toEqual([]);
    });
});
