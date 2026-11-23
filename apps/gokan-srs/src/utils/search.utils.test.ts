import { describe, expect, it } from 'vitest';
import { kanjiToColumns, readExploreQuery, readSearchQuery, searchWordRow, toColumns } from '@gokan/dataset-schema';
import type { SearchGrammarRow, SearchKanjiRow, SearchWordRow } from '@gokan/dataset-schema';
import { vocabulary } from '../test/fixtures';
import { matchesVocabQuery, matchesWordRow, prepareAppSearch, searchApp, wordRowsById, type AppSearchHit, type AppSearchIndex } from './search.utils';

/** A word's search row, as the build writes it (searchWordRow): JLPT level 0 and not common unless given. */
const word = (id: string, kanji: string, reading: string, gloss: string, { jlpt, kana = false, pos = ['n'] }: { jlpt?: number; kana?: boolean; pos?: string[] } = {}): SearchWordRow =>
    searchWordRow(vocabulary({ id, writtenForm: { kanji, alternatives: [], containedKanji: [] }, reading: { primary: reading, alternatives: [] }, senses: [{ pos, misc: { rawTags: [] }, glosses: [gloss], related: { compounds: [] } }], jlptLevel: jlpt, isCommon: false, ...(kana ? { usuallyKana: true as const } : {}) }));

/** An index of rows in frequency order. */
const indexOf = (words: SearchWordRow[], kanji: SearchKanjiRow[] = [], grammar: SearchGrammarRow[] = []): AppSearchIndex =>
    prepareAppSearch({ w: toColumns(words), k: kanjiToColumns(kanji), g: grammar });

/** The words the header search shows for `query`, in its order. */
const wordIds = (index: AppSearchIndex, query: string) => searchApp(index, query).hits.flatMap(hit => (hit.group === 'words' ? [hit.hit.row[0]] : []));

/** A hit as `group:id`, for a whole ranking at a glance. */
const label = (hit: AppSearchHit): string => {
    switch (hit.group) {
        case 'words': return `words:${hit.hit.row[0]}`;
        case 'kanji': return `kanji:${hit.row[0]}`;
        case 'grammar': return `grammar:${hit.row[0]}`;
    }
};
const ranking = (index: AppSearchIndex, query: string) => searchApp(index, query).hits.map(label);
const groupRows = <G extends AppSearchHit['group']>(index: AppSearchIndex, query: string, group: G) =>
    searchApp(index, query).hits.filter((hit): hit is Extract<AppSearchHit, { group: G }> => hit.group === group);

describe('the header search over words', () => {
    // In frequency order, as the dictionary's index: a row's position is its rank.
    const index = indexOf([
        word('suru', '為る', 'する', 'to do', { jlpt: 5, kana: true, pos: ['vs-i'] }),
        word('kigasuru', '気がする', 'きがする', 'to have a feeling'),
        word('surume', '鯣', 'するめ', 'dried squid'),
        word('taberu', '食べる', 'たべる', 'to eat', { jlpt: 5, pos: ['v1'] }),
        word('chotto', '一寸', 'ちょっと', 'a little', { kana: true }),
    ]);

    it('puts the word shown as the query first, then prefixes, then words containing it', () => {
        expect(wordIds(index, 'する')).toEqual(['suru', 'surume', 'kigasuru']);
    });

    it('reads romaji, a romaji syllable typed partway, and a word learned in kana by its kanji', () => {
        expect(['tabe', 'taber', 'taberu'].map(query => wordIds(index, query)[0])).toEqual(['taberu', 'taberu', 'taberu']);
        expect(wordIds(index, 'chot')[0]).toBe('chotto');
        expect(wordIds(index, '一寸')).toEqual(['chotto']);
    });

    it('finds a word from a conjugated form, as the dictionary does', () => {
        expect(wordIds(index, '食べた')[0]).toBe('taberu');
    });

    it('returns nothing for an empty query', () => {
        expect(searchApp(index, '  ').hits).toEqual([]);
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
    const words = [word('mizu', '水', 'みず', 'water'), word('suiyoubi', '水曜日', 'すいようび', 'Wednesday')];
    const kanji: SearchKanjiRow[] = [['水', 5, 9201, 'water', 'スイ みず みず-'], ['吹', 3, 1200, 'blow; breathe', 'スイ ふ.く']];
    const grammar: SearchGrammarRow[] = [['n5-048', 'Verb てから～', '〜te kara', "Express a sequence of actions or events; 'after'.", 5]];
    const index = indexOf(words, kanji, grammar);

    it('finds the kanji 水 by its character, meaning and readings', () => {
        for (const query of ['水', 'water', 'みず', 'すい', 'sui', 'mizu']) expect(groupRows(index, query, 'kanji')[0]?.row[0]).toBe('水');
        expect(groupRows(index, 'mizu', 'words').map(hit => hit.hit.row[0])).toEqual(['mizu']);
    });

    it('finds a grammar point by its title, its romaji and its kana', () => {
        for (const query of ['てから', 'te kara', 'tekara']) expect(groupRows(index, query, 'grammar').map(hit => hit.row[0])).toEqual(['n5-048']);
    });

    it('lists every type in one order: the kanji first for one kanji, a grammar title first, a word otherwise', () => {
        expect(ranking(index, '水')[0]).toBe('kanji:水');
        expect(ranking(index, 'てから')[0]).toBe('grammar:n5-048');
        expect(ranking(index, 'water')[0]).toBe('words:mizu');
    });

    it('ranks an exact match of any type above a prefix, and a prefix above a meaning', () => {
        const mixed = indexOf(
            [word('kara', '空', 'から', 'empty'), word('karada', '体', 'からだ', 'body'), word('mizu', '水', 'みず', 'water'), word('suido', '水道', 'すいどう', 'water supply')],
            [['水', 5, 9201, 'water', 'スイ みず'], ['空', 5, 300, 'sky; empty', 'クウ そら から']],
            [['n5-kara', 'から', 'kara', 'Because; since.', 5]],
        );
        // The grammar title is the query, then the word read から, the word starting with it, and the kanji read から.
        expect(ranking(mixed, 'から')).toEqual(['grammar:n5-kara', 'words:kara', 'words:karada', 'kanji:空']);
        // A sense equal to "water" (水), then the kanji meaning it, then a gloss with it as a word.
        expect(ranking(mixed, 'water')).toEqual(['words:mizu', 'kanji:水', 'words:suido']);
    });

    it('caps nothing: every match of every type is in the list', () => {
        const many = indexOf(
            Array.from({ length: 80 }, (_, i) => word(`w${i}`, `水${i}`, `すい${i}`, 'water')),
            ['水', '吹', '推', '垂', '炊', '粋', '酔'].map((k): SearchKanjiRow => [k, 5, 100, 'water', 'スイ']),
            [['n5-073', 'Verb やすい', '〜yasui', 'easy to do', 5]],
        );
        const hits = searchApp(many, 'sui').hits;
        expect(hits.filter(hit => hit.group === 'words')).toHaveLength(80);
        expect(hits.filter(hit => hit.group === 'kanji')).toHaveLength(7);
        expect(hits.filter(hit => hit.group === 'grammar')).toHaveLength(1);
    });
});

describe('the panel searches over the header search word rows', () => {
    const rows = wordRowsById({ w: toColumns([
        word('1', '水', 'みず', 'water'),
        word('2', '此処', 'ここ', 'here; this place', { kana: true }),
        word('3', '食べる', 'たべる', 'to eat', { pos: ['v1'] }),
    ]) });
    const kept = (text: string) => ['1', '2', '3', 'missing'].filter(id => {
        const query = readExploreQuery(text);
        return query !== null && matchesWordRow(query, rows.get(id));
    });

    it('keeps the ids whose row matches by headword, reading or gloss', () => {
        expect(kept('水')).toEqual(['1']);
        expect(kept('たべ')).toEqual(['3']);
        expect(kept('eat')).toEqual(['3']);
        expect(kept('place')).toEqual(['2']);
    });

    it('finds a word learned in kana by its kanji spelling, and an id with no row by nothing', () => {
        expect(kept('此処')).toEqual(['2']);
        expect(kept('ここ')).toEqual(['2']);
    });
});
