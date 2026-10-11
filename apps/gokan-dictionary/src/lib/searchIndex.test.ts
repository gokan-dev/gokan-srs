import { describe, expect, it } from 'vitest';
import {
    CORE_FREQUENT_WORDS, isCommonRow, readingOfRow, searchGrammarRow, searchKanjiRow, searchWordRow, splitSearchIndex, wordClassOfRow,
} from './searchIndex';
import type { SearchWordRow } from './types';
import { grammarPoint, kanji, vocabulary } from '../test/fixtures';

describe('searchWordRow', () => {
    it('packs a word into a compact row', () => {
        const row = searchWordRow(vocabulary({ jlptLevel: 4 }));
        expect(row.slice(0, 5)).toEqual(['1589350', '思う', 'おもう', 'to think; to consider', 4]);
        expect(isCommonRow(row)).toBe(true);
        expect(readingOfRow(row)).toBe('おもう');
        expect(wordClassOfRow(row)).toBe('godan');
    });

    it('names a word learned in kana by its kana, its kanji spelling second', () => {
        const row = searchWordRow(vocabulary({
            writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] },
            reading: { primary: 'ここ', alternatives: [] },
            senses: [{ pos: ['pn'], misc: { rawTags: [] }, glosses: ['here'], related: { compounds: [] } }],
            usuallyKana: true,
            isCommon: false,
        }));
        expect(row.slice(0, 5)).toEqual(['1589350', 'ここ', '此処', 'here', 0]);
        expect(readingOfRow(row)).toBe('ここ');
        expect(isCommonRow(row)).toBe(false);
        expect(wordClassOfRow(row)).toBeNull();
    });
});

describe('searchKanjiRow and searchGrammarRow', () => {
    it('packs a kanji, 0 standing for a missing level or rank', () => {
        expect(searchKanjiRow(kanji())).toEqual(['学', 5, 63]);
        expect(searchKanjiRow(kanji({ steps: {}, frequency: undefined }))).toEqual(['学', 0, 0]);
    });

    it('packs a grammar point', () => {
        expect(searchGrammarRow(grammarPoint())).toEqual(['n2-169', '～を問わず', '〜wo towazu', "Means 'regardless of' or 'irrespective of'.", 2]);
    });
});

describe('splitSearchIndex', () => {
    const row = (id: string, jlpt: number): SearchWordRow => [id, id, id, '', jlpt, 0];

    it('keeps JLPT words and the most frequent words in the core, in frequency order', () => {
        const words = Array.from({ length: CORE_FREQUENT_WORDS + 3 }, (_, i) => row(`w${i}`, 0));
        words[CORE_FREQUENT_WORDS + 1] = row('jlpt', 2);
        const { core, full } = splitSearchIndex(words, [], []);
        expect(core.w).toHaveLength(CORE_FREQUENT_WORDS + 1);
        expect(core.w[CORE_FREQUENT_WORDS][0]).toBe('jlpt');
        expect(full.w.map(r => r[0])).toEqual([`w${CORE_FREQUENT_WORDS}`, `w${CORE_FREQUENT_WORDS + 2}`]);
        expect(full.k).toBeUndefined();
    });
});
