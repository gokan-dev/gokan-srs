import { describe, expect, it } from 'vitest';
import { enSearch } from './en';

describe('enSearch', () => {
    it('counts results in English, one or many', () => {
        expect(enSearch.status(0)).toBe('No results');
        expect(enSearch.status(1)).toBe('1 result');
        expect(enSearch.status(12)).toBe('12 results');
        expect(enSearch.sectionHeading(enSearch.groups.words, 1234)).toBe('Words (1,234)');
        expect(enSearch.sectionHeading(enSearch.groups.grammar, 30)).toBe('Grammar (30)');
        expect(enSearch.showAll('grammar', 30)).toBe('Show all 30 grammar points');
        expect(enSearch.showAll('kanji', 24)).toBe('Show all 24 kanji');
    });
});
