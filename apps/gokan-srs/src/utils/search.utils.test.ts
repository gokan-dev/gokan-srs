import { describe, expect, it } from 'vitest';
import { readSearchQuery } from '@gokan/dataset-schema';
import type { SearchGrammarRow, SearchIndex, SearchKanjiRow } from '@gokan/dataset-schema';
import { searchIndexEntry, vocabulary } from '../test/fixtures';
import { matchesVocabQuery, prepareAppSearch, searchApp } from './search.utils';

/** The words the header search shows for `query`, as it ranked them before kanji and grammar were searched. */
const rankVocabSearch = (index: SearchIndex, query: string, limit = 50) =>
    searchApp(prepareAppSearch(index), query, { words: limit, kanji: 0, grammar: 0 }).words.map(hit => hit.row);

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

    it('reads a Japanese query against Japanese only, and caps the list', () => {
        // A Japanese query is not matched against English glosses (the dictionary never did), so
        // a gloss that happens to quote する no longer follows the words.
        const mixed = [
            searchIndexEntry({ id: 'gloss', w: '話', r: 'はなし', m: 'talk about する' }),
            searchIndexEntry({ id: 'word', w: '気がする', r: 'きがする', m: 'to have a feeling' }),
        ];
        expect(rankVocabSearch(mixed, 'する').map(entry => entry.id)).toEqual(['word']);
        expect(rankVocabSearch(index, 'する', 2).map(entry => entry.id)).toEqual(['suru', 'suru-rub']);
    });

    it('keeps a word while its romaji is typed partway through a syllable', () => {
        const words = [
            searchIndexEntry({ id: 'tabemono', w: '食べ物', r: 'たべもの', m: 'food' }),
            searchIndexEntry({ id: 'taberu', w: '食べる', r: 'たべる', m: 'to eat' }),
            searchIndexEntry({ id: 'benkyou', w: '勉強', r: 'べんきょう', m: 'study' }),
            searchIndexEntry({ id: 'nihongo', w: '日本語', r: 'にほんご', m: 'Japanese (language)' }),
            searchIndexEntry({ id: 'chotto', w: '一寸', r: 'ちょっと', m: 'a little', u: true }),
            searchIndexEntry({ id: 'kana', w: '仮名', r: 'かな', m: 'kana' }),
        ];
        const first = (query: string) => rankVocabSearch(words, query)[0]?.id;
        expect(['tabe', 'taber', 'taberu'].map(first)).toEqual(['taberu', 'taberu', 'taberu']);
        expect(first('benky')).toBe('benkyou');
        expect(first('nihong')).toBe('nihongo');
        expect(first('chot')).toBe('chotto');
        expect(rankVocabSearch(words, 'kan').map(entry => entry.id)).toContain('kana');
    });

    it('ranks an English whole word in the gloss before a reading the romaji only starts', () => {
        const words = [
            searchIndexEntry({ id: 'kara', w: '空', r: 'から', m: 'empty' }),
            searchIndexEntry({ id: 'kariru', w: '借りる', r: 'かりる', m: 'to borrow' }),
            searchIndexEntry({ id: 'houseki', w: '宝石', r: 'ほうせき', m: 'gem; jewel' }),
            searchIndexEntry({ id: 'cart', w: '荷車', r: 'にぐるま', m: 'cart' }),
            searchIndexEntry({ id: 'car', w: '車', r: 'くるま', m: 'car; automobile' }),
            searchIndexEntry({ id: 'ie', w: '家', r: 'いえ', m: 'house; residence' }),
            searchIndexEntry({ id: 'okara', w: '雪花菜', r: 'おから', m: 'okara (soy pulp)' }),
        ];
        const ranked = (query: string) => rankVocabSearch(words, query).map(entry => entry.id);
        // "car" is not romaji (no syllable starts with c alone); a gloss containing it (cart) follows.
        expect(ranked('car')).toEqual(['car', 'cart']);
        // "house" reads ほうせ, which 宝石 starts with.
        expect(ranked('house')).toEqual(['ie', 'houseki']);
        // A gloss that only contains the query (okara) stays below the romaji prefixes.
        expect(ranked('kar')).toEqual(['kara', 'kariru', 'okara']);
    });

    it('reads a romaji query as an IME does: spaces dropped, \' after n, - as ー', () => {
        const words = [
            searchIndexEntry({ id: 'taberu', w: '食べる', r: 'たべる', m: 'to eat' }),
            searchIndexEntry({ id: 'kani', w: '蟹', r: 'かに', m: 'crab' }),
            searchIndexEntry({ id: 'kan-i', w: '簡易', r: 'かんい', m: 'simple; easy' }),
            searchIndexEntry({ id: 'coffee', w: '珈琲', r: 'コーヒー', m: 'coffee', u: true }),
        ];
        const first = (query: string) => rankVocabSearch(words, query)[0]?.id;
        expect(first('tabe ru')).toBe('taberu');
        expect(first("kan'i")).toBe('kan-i');
        expect(first('kani')).toBe('kani');
        expect(first('ko-hi-')).toBe('coffee');
        expect(first('ko-h')).toBe('coffee');
    });

    it('returns nothing for an empty query', () => {
        expect(rankVocabSearch(index, '  ')).toEqual([]);
    });
});

describe('matchesVocabQuery', () => {
    const taberu = vocabulary({
        id: 'taberu',
        writtenForm: { kanji: '食べる', alternatives: [], containedKanji: ['食'] },
        reading: { primary: 'たべる', alternatives: [] },
        senses: [{ pos: ['v1'], misc: { rawTags: [] }, glosses: ['to eat'], related: { compounds: [] } }],
    });
    const matches = (query: string) => {
        const read = readSearchQuery(query);
        return read !== null && matchesVocabQuery(taberu, read);
    };

    it('keeps a word as the header search finds it: written form, reading, romaji typed partway, gloss', () => {
        expect(['食べ', 'べる', 'tabe', 'taber', 'tabe ru', 'eat'].map(matches)).toEqual([true, true, true, true, true, true]);
    });

    it('drops a word the query does not reach', () => {
        expect(['tabo', 'drink', '飲'].map(matches)).toEqual([false, false, false]);
    });
});

describe('the header search over kanji and grammar', () => {
    const words = [searchIndexEntry({ id: 'mizu', w: '水', r: 'みず', m: 'water' }), searchIndexEntry({ id: 'suiyoubi', w: '水曜日', r: 'すいようび', m: 'Wednesday' })];
    const kanji: SearchKanjiRow[] = [['水', 5, 9201, 'water', 'スイ みず みず-'], ['吹', 3, 1200, 'blow; breathe', 'スイ ふ.く']];
    const grammar: SearchGrammarRow[] = [['n5-048', 'Verb てから～', '〜te kara', "Express a sequence of actions or events; 'after'.", 5]];
    const index = prepareAppSearch(words, kanji, grammar);

    it('finds the kanji 水 by its character, meaning and readings', () => {
        for (const query of ['水', 'water', 'みず', 'すい', 'sui', 'mizu']) expect(searchApp(index, query).kanji[0]?.[0]).toBe('水');
        expect(searchApp(index, 'mizu').words.map(hit => hit.row.id)).toEqual(['mizu']);
    });

    it('finds a grammar point by its title, its romaji and its kana', () => {
        for (const query of ['てから', 'te kara', 'tekara']) expect(searchApp(index, query).grammar.map(row => row[0])).toEqual(['n5-048']);
    });

    it('shows kanji first for one kanji, grammar first for a title, words first otherwise', () => {
        expect(searchApp(index, '水').groups[0]).toBe('kanji');
        expect(searchApp(index, 'てから').groups[0]).toBe('grammar');
        expect(searchApp(index, 'water').groups[0]).toBe('words');
    });

    it('caps each group', () => {
        expect(searchApp(index, 'すい', { words: 1, kanji: 1, grammar: 1 }).kanji).toEqual([kanji[0]]);
    });
});
