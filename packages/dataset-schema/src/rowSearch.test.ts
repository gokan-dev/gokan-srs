import { describe, expect, it } from 'vitest';
import { prepareRowSearch, wordClassOfRow } from './rowSearch';
import { runSearch } from './search';
import { toColumns, type SearchWordRow } from './searchRows';

describe('prepareRowSearch', () => {
    const omou: SearchWordRow = ['1', '思う', 'おもう', 'to think', 5, 1 | (2 << 2)];
    const koko: SearchWordRow = ['2', 'ここ', '此処', 'here', 5, 2];
    const taberu: SearchWordRow = ['3', '食べる', 'たべる', 'to eat', 5, 1 | (1 << 2)];

    it('reads a row\'s conjugation class', () => {
        expect(wordClassOfRow(taberu)).toBe('ichidan');
        expect(wordClassOfRow(omou)).toBe('godan');
        expect(wordClassOfRow(koko)).toBeNull();
    });

    it('prepares an index that finds a word by its kanji spelling and from a conjugated form', () => {
        const index = prepareRowSearch([{ w: toColumns([omou, koko, taberu]) }]);
        expect(runSearch(index, '此処').words.map(hit => hit.row[0])).toEqual(['2']);
        expect(runSearch(index, '食べた').words[0]).toMatchObject({ row: taberu, via: '食べた' });
    });
});
