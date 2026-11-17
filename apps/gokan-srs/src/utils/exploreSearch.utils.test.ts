import { describe, expect, it } from 'vitest';
import { readExploreQuery, resultCountLine } from './exploreSearch.utils';

function query(raw: string) {
    const q = readExploreQuery(raw);
    if (!q) throw new Error(`no query for "${raw}"`);
    return q;
}

describe('resultCountLine', () => {
    const noun = 'sentence';

    it('counts everything without a query', () => {
        expect(resultCountLine(1030, 1030, noun, null)).toBe('1,030 sentences');
        expect(resultCountLine(1, 1, noun, null)).toBe('1 sentence');
        expect(resultCountLine(2, 2, 'related word', null)).toBe('2 related words');
    });

    it('says how many of them match a query', () => {
        expect(resultCountLine(15, 1030, noun, query(' eat '))).toBe('15 of 1,030 match "eat"');
        expect(resultCountLine(1, 1030, noun, query('eat'))).toBe('1 of 1,030 matches "eat"');
        expect(resultCountLine(0, 1030, noun, query('eat'))).toBe('0 of 1,030 match "eat"');
    });
});
