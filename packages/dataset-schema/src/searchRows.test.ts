import { describe, expect, it } from 'vitest';
import {
    classCodeOfRow, fromColumns, isCommonRow, kanjiRowMainReadings, kanjiRowMeanings, readingOfRow, SEARCH_EXPLANATION_LENGTH, searchGrammarRow, searchKanjiRow, toColumns,
    truncateAtWord, type SearchWordRow,
} from './searchRows';

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

describe('search word rows', () => {
    const omou: SearchWordRow = ['1', '思う', 'おもう', 'to think', 5, 1 | (2 << 2)];
    const koko: SearchWordRow = ['2', 'ここ', '此処', 'here', 5, 2];

    it('reads the common flag and the class code', () => {
        expect(isCommonRow(omou)).toBe(true);
        expect(isCommonRow(koko)).toBe(false);
        expect(classCodeOfRow(omou)).toBe(2);
        expect(classCodeOfRow(koko)).toBe(0);
    });

    it('reads the headword as the reading of a word learned in kana', () => {
        expect(readingOfRow(omou)).toBe('おもう');
        expect(readingOfRow(koko)).toBe('ここ');
    });

    it('stores words column by column, and reads them back', () => {
        expect(fromColumns(toColumns([omou, koko]))).toEqual([omou, koko]);
    });
});

describe('kanjiRowMainReadings', () => {
    it('lists the first on and kun readings, a kun reading as it is shown, without affix forms', () => {
        expect(kanjiRowMainReadings(['水', 5, 9201, 'water', 'スイ みず みず-'])).toEqual(['スイ', 'みず']);
        expect(kanjiRowMainReadings(['学', 5, 63, 'study', 'ガク まな.ぶ'])).toEqual(['ガク', 'まな(ぶ)']);
        expect(kanjiRowMainReadings(['生', 5, 29, 'life', 'セイ ショウ ジョウ い.きる い.かす う.まれる'])).toEqual(['セイ', 'ショウ', 'い(きる)', 'い(かす)']);
        expect(kanjiRowMainReadings(['瑞', 0, 0, '', ''])).toEqual([]);
    });
});
