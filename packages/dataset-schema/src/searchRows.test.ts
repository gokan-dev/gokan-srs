import { describe, expect, it } from 'vitest';
import { kanjiRowMeanings, SEARCH_EXPLANATION_LENGTH, searchGrammarRow, searchKanjiRow, truncateAtWord } from './searchRows';

describe('searchKanjiRow', () => {
    it('keeps the character, level, rank, meanings and readings as KANJIDIC writes them', () => {
        const row = searchKanjiRow({ character: '学', steps: { jlpt: 5 }, frequency: 5839, meanings: ['study', 'learning'], readings: { on: ['ガク'], kun: ['まな.ぶ'], nanori: ['たか'] } });
        expect(row).toEqual(['学', 5, 5839, 'study; learning', 'ガク まな.ぶ']);
        expect(kanjiRowMeanings(row)).toEqual(['study', 'learning']);
    });

    it('writes 0 for a kanji outside the JLPT and the frequency list', () => {
        const row = searchKanjiRow({ character: '瑞', steps: {}, meanings: [], readings: { on: [], kun: [], nanori: [] } });
        expect(row).toEqual(['瑞', 0, 0, '', '']);
        expect(kanjiRowMeanings(row)).toEqual([]);
    });
});

describe('searchGrammarRow', () => {
    it('cuts the explanation at a word', () => {
        const row = searchGrammarRow({ id: 'n5-048', title: 'Verb てから～', shortExplanation: 'word '.repeat(30), jlptLevel: 5 });
        expect(row[2]).toBe('');
        expect(row[3].length).toBeLessThanOrEqual(SEARCH_EXPLANATION_LENGTH);
        expect(row[3].endsWith('…')).toBe(true);
    });
});

describe('truncateAtWord', () => {
    it('leaves a short text whole and cuts a long one at a space', () => {
        expect(truncateAtWord('to eat', 10)).toBe('to eat');
        expect(truncateAtWord('to eat; to live on', 10)).toBe('to eat…');
    });
});
