import { describe, expect, it } from 'vitest';
import { enSearch } from './en';

describe('enSearch', () => {
    it('counts results in English, one or many', () => {
        expect(enSearch.status(0)).toBe('No results');
        expect(enSearch.status(1)).toBe('1 result');
        expect(enSearch.status(12)).toBe('12 results');
        expect(enSearch.wordsHeading(1234)).toBe('Words (1,234)');
    });
});
