import { describe, expect, it } from 'vitest';
import { englishRanges, matchesExploreQuery, readExploreQuery, resultCountLine, splitAtRanges } from './exploreSearch.utils';

function query(raw: string) {
    const q = readExploreQuery(raw);
    if (!q) throw new Error(`no query for "${raw}"`);
    return q;
}

describe('readExploreQuery', () => {
    it('reads an empty or blank field as no query', () => {
        expect(readExploreQuery('')).toBeNull();
        expect(readExploreQuery('   ')).toBeNull();
    });

    it('tells English from Japanese', () => {
        expect(query('eat').kind).toBe('english');
        expect(query('食べ').kind).toBe('japanese');
        expect(query('タベ').kind).toBe('japanese');
    });
});

describe('matchesExploreQuery', () => {
    const row = (english: string[], japanese: string[] = []) => ({ english, japanese });

    it('matches English from the start of a word, any case', () => {
        expect(matchesExploreQuery(query('eat'), row(['I have eaten.']))).toBe(true);
        expect(matchesExploreQuery(query('eat'), row(['Eat up.']))).toBe(true);
        expect(matchesExploreQuery(query('eat'), row(['A great meal.']))).toBe(false);
        expect(matchesExploreQuery(query('do'), row(['a to-do list']))).toBe(true);
    });

    it('takes a query with regex characters literally', () => {
        expect(matchesExploreQuery(query('(eat'), row(['to (eat) rice']))).toBe(true);
        expect(matchesExploreQuery(query('e.t'), row(['eat']))).toBe(false);
    });

    it('matches Japanese anywhere, hiragana and katakana alike', () => {
        expect(matchesExploreQuery(query('べる'), row([], ['ご飯を食べる']))).toBe(true);
        expect(matchesExploreQuery(query('コーヒー'), row([], ['こーひーを飲む']))).toBe(true);
        expect(matchesExploreQuery(query('ひかる'), row([], ['ヒカル']))).toBe(true);
        expect(matchesExploreQuery(query('飲む'), row(['drink'], ['食べる']))).toBe(false);
    });

    it('does not match an English query against Japanese text, nor the reverse', () => {
        expect(matchesExploreQuery(query('eat'), row([], ['eat']))).toBe(false);
        expect(matchesExploreQuery(query('食'), row(['食'], []))).toBe(false);
    });
});

describe('englishRanges and splitAtRanges', () => {
    it('marks every match, at the start of a word only', () => {
        const line = 'Eat what you eat, not what is great.';
        const ranges = englishRanges(query('eat'), line);
        expect(ranges).toEqual([[0, 3], [13, 16]]);
        expect(splitAtRanges(line, ranges)).toEqual([
            { text: 'Eat', match: true },
            { text: ' what you ', match: false },
            { text: 'eat', match: true },
            { text: ', not what is great.', match: false },
        ]);
    });

    it('marks nothing for a Japanese query or none', () => {
        expect(englishRanges(query('食べ'), 'eat')).toEqual([]);
        expect(englishRanges(null, 'eat')).toEqual([]);
        expect(splitAtRanges('eat', [])).toEqual([{ text: 'eat', match: false }]);
    });
});

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
