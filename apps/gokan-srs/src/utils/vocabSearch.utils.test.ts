import { describe, expect, it } from 'vitest';
import { searchIndexEntry } from '../test/fixtures';
import { rankVocabSearch } from './vocabSearch.utils';

// In search.json's order (kanji spelling): compounds containing する come before 為る.
const index = [
    searchIndexEntry({ id: 'kigasuru', w: '気がする', r: 'きがする', m: 'to have a feeling' }),
    searchIndexEntry({ id: 'aisuru', w: '愛する', r: 'あいする', m: 'to love' }),
    searchIndexEntry({ id: 'suruga', w: '駿河', r: 'するが', m: 'Suruga (province)' }),
    searchIndexEntry({ id: 'kosuru', w: '擦る', r: 'こする', m: 'to rub' }),
    searchIndexEntry({ id: 'suru-rub', w: '擦る', r: 'する', m: 'to rub; to strike' }),
    searchIndexEntry({ id: 'suru-print', w: '刷る', r: 'する', m: 'to print' }),
    searchIndexEntry({ id: 'suru', w: '為る', r: 'する', m: 'to do', u: true }),
    searchIndexEntry({ id: 'surume', w: '鯣', r: 'するめ', m: 'dried squid' }),
];

const ids = (query: string) => rankVocabSearch(index, query).map(entry => entry.id);

describe('rankVocabSearch', () => {
    it('puts the word shown as the query first, then exact spellings, prefixes and substrings', () => {
        // 愛する and こする tie on length (3), so index order settles them.
        expect(ids('する')).toEqual(['suru', 'suru-rub', 'suru-print', 'suruga', 'surume', 'aisuru', 'kosuru', 'kigasuru']);
    });

    it('ranks a romaji query by its kana as a reading', () => {
        // Only readings match romaji, so 愛する is measured by あいする (4) and ties with きがする.
        expect(ids('suru')).toEqual(['suru', 'suru-rub', 'suru-print', 'suruga', 'surume', 'kosuru', 'kigasuru', 'aisuru']);
    });

    it('ranks an exact kanji spelling before longer words containing it', () => {
        const kanji = [
            searchIndexEntry({ id: 'mainichi', w: '毎日', r: 'まいにち' }),
            searchIndexEntry({ id: 'nichiyou', w: '日曜', r: 'にちよう' }),
            searchIndexEntry({ id: 'hi', w: '日', r: 'ひ' }),
        ];
        expect(rankVocabSearch(kanji, '日').map(entry => entry.id)).toEqual(['hi', 'nichiyou', 'mainichi']);
    });

    it('keeps index order for an English query', () => {
        expect(ids('to ')).toEqual(['kigasuru', 'aisuru', 'kosuru', 'suru-rub', 'suru-print', 'suru']);
    });

    it('puts Japanese matches before gloss matches and caps the list', () => {
        const mixed = [
            searchIndexEntry({ id: 'gloss', w: '話', r: 'はなし', m: 'talk about する' }),
            searchIndexEntry({ id: 'word', w: '気がする', r: 'きがする', m: 'to have a feeling' }),
        ];
        expect(rankVocabSearch(mixed, 'する').map(entry => entry.id)).toEqual(['word', 'gloss']);
        expect(rankVocabSearch(index, 'する', 2).map(entry => entry.id)).toEqual(['suru', 'suru-rub']);
    });

    it('returns nothing for an empty query', () => {
        expect(rankVocabSearch(index, '  ')).toEqual([]);
    });
});
