import { describe, expect, it } from 'vitest';
import { normalizeQuery, prepareIndex, search, TIER } from './searchQuery';
import { searchGrammarRow, searchKanjiRow, searchWordRow, toColumns } from './searchIndex';
import type { SearchWordRow } from './types';
import { grammarPoint, kanji, vocabulary } from '../test/fixtures';

type WordSpec = { id: string; kanji: string; reading: string; glosses: string[]; pos?: string[]; jlpt?: number; common?: boolean; kana?: boolean };

function row({ id, kanji: written, reading, glosses, pos = ['n'], jlpt, common = false, kana = false }: WordSpec): SearchWordRow {
    return searchWordRow(vocabulary({
        id,
        writtenForm: { kanji: written, alternatives: [], containedKanji: [] },
        reading: { primary: reading, alternatives: [] },
        senses: [{ pos, misc: { rawTags: [] }, glosses, related: { compounds: [] } }],
        jlptLevel: jlpt,
        isCommon: common,
        ...(kana ? { usuallyKana: true as const } : {}),
    }));
}

// In frequency order: a row's position is its rank.
const WORDS: SearchWordRow[] = [
    row({ id: 'eating', kanji: '食事', reading: 'しょくじ', glosses: ['meal', 'eating'], jlpt: 4, common: true }),
    row({ id: 'taberu', kanji: '食べる', reading: 'たべる', glosses: ['to eat'], pos: ['v1', 'vt'], jlpt: 5, common: true }),
    row({ id: 'kuu', kanji: '食う', reading: 'くう', glosses: ['to eat'], pos: ['v5u', 'vt'], common: true }),
    row({ id: 'nama', kanji: '生', reading: 'なま', glosses: ['raw'], jlpt: 3, common: true }),
    row({ id: 'seikatsu', kanji: '生活', reading: 'せいかつ', glosses: ['life', 'living'], jlpt: 4, common: true }),
    row({ id: 'sensei', kanji: '先生', reading: 'せんせい', glosses: ['teacher'], jlpt: 5, common: true }),
    row({ id: 'koko', kanji: '此処', reading: 'ここ', glosses: ['here', 'this place'], jlpt: 5, common: true, kana: true }),
    row({ id: 'koohii', kanji: 'コーヒー', reading: 'コーヒー', glosses: ['coffee'], jlpt: 5, common: true }),
    row({ id: 'great', kanji: '偉大', reading: 'いだい', glosses: ['great'], common: true }),
    row({ id: 'iku', kanji: '行く', reading: 'いく', glosses: ['to go'], pos: ['v5k-s', 'vi'], jlpt: 5, common: true }),
    row({ id: 'kani', kanji: '蟹', reading: 'かに', glosses: ['crab'] }),
    row({ id: 'kan-i', kanji: '簡易', reading: 'かんい', glosses: ['simple', 'easy'] }),
];

const INDEX = prepareIndex([
    { w: toColumns(WORDS.slice(0, 6)), k: [searchKanjiRow(kanji({ character: '生' })), searchKanjiRow(kanji({ character: '食' }))], g: [
        searchGrammarRow(grammarPoint({ id: 'g-kara', title: 'から', romaji: 'kara' })),
        searchGrammarRow(grammarPoint({ id: 'g-tekara', title: '～てから', romaji: '~te kara', shortExplanation: 'After doing something.' })),
    ] },
    { w: toColumns(WORDS.slice(6)) },
]);

const ids = (query: string) => search(INDEX, query).words.map(hit => hit.row[0]);

describe('normalizeQuery', () => {
    it('folds full-width Latin, trims and lowercases', () => {
        expect(normalizeQuery('  ＴＡＢＥＲＵ ')).toBe('taberu');
        expect(normalizeQuery('to  eat')).toBe('to eat');
    });
});

describe('search', () => {
    it('finds a word by its headword or reading first', () => {
        expect(ids('食べる')[0]).toBe('taberu');
        expect(search(INDEX, 'たべる').words[0]).toEqual({ row: WORDS[1], tier: TIER.exact });
    });

    it('compares katakana and hiragana as equal', () => {
        expect(ids('こーひー')[0]).toBe('koohii');
    });

    it('reads romaji as kana, and says so', () => {
        const results = search(INDEX, 'taberu');
        expect(results.kana).toBe('たべる');
        expect(results.words[0]).toEqual({ row: WORDS[1], tier: TIER.romaji });
    });

    it('does not read English as romaji', () => {
        expect(search(INDEX, 'eat').kana).toBeNull();
    });

    it('ranks an English sense above a reading the query only starts as romaji', () => {
        // "tabe" reads as たべ, the start of たべる; "here" reads as へれ but is the English sense of ここ.
        expect(search(INDEX, 'tabe').words[0]).toEqual({ row: WORDS[1], tier: TIER.romajiPrefix });
        expect(search(INDEX, 'here').words.map(hit => hit.tier)).toEqual([TIER.sense]);
    });

    it('keeps a word while its romaji is typed partway through a syllable', () => {
        expect(search(INDEX, 'taber').words[0]).toEqual({ row: WORDS[1], tier: TIER.romajiPrefix });
        expect(search(INDEX, 'taber').kana).toBeNull();
    });

    it('reads romaji as an IME does: spaces dropped, \' after n, - as ー', () => {
        expect(ids('tabe ru')[0]).toBe('taberu');
        expect(search(INDEX, "kan'i").kana).toBe('かんい');
        expect(ids("kan'i")[0]).toBe('kan-i');
        expect(ids('kani')[0]).toBe('kani');
        expect(search(INDEX, 'ko-hi-').words[0]).toEqual({ row: WORDS[7], tier: TIER.romaji });
    });

    it('finds the dictionary form of a conjugated query, naming the form typed', () => {
        expect(search(INDEX, '食べた').words[0]).toEqual({ row: WORDS[1], tier: TIER.deinflected, via: '食べた' });
        expect(ids('tabenakatta')[0]).toBe('taberu');
        expect(ids('行って')[0]).toBe('iku');
    });

    it('only reads a conjugated form as a word of the matching class', () => {
        // 食う is godan: 食った is its past, 食いた is no form of it.
        expect(ids('食った')).toContain('kuu');
        expect(ids('食いた')).not.toContain('kuu');
    });

    it('ranks an equal English sense above a gloss that only mentions the word', () => {
        // 食事 ("eating") is more frequent, but "eat" equals 食べる's sense "to eat".
        expect(ids('eat').slice(0, 2)).toEqual(['taberu', 'kuu']);
        expect(ids('eat')).toContain('eating');
        expect(ids('to eat')[0]).toBe('taberu');
    });

    it('puts JLPT words before others within a tier', () => {
        // Both senses equal "eat"; 食べる is a JLPT word, 食う is not.
        expect(ids('eat')[0]).toBe('taberu');
    });

    it('matches the query as a whole word before a substring', () => {
        expect(ids('eat')).toEqual(['taberu', 'kuu', 'eating', 'great']);
        expect(search(INDEX, 'eat').words.map(hit => hit.tier)).toEqual([TIER.sense, TIER.sense, TIER.substring, TIER.substring]);
        expect(search(INDEX, 'place').words).toEqual([{ row: WORDS[6], tier: TIER.glossWord }]);
    });

    it('treats a compound containing a kanji query like a prefix match', () => {
        expect(ids('生')).toEqual(['nama', 'seikatsu', 'sensei']);
    });

    it('finds words in the full file, ranked after the core', () => {
        expect(ids('here')).toEqual(['koko']);
        expect(ids('ここ')).toEqual(['koko']);
    });

    it('lists the kanji of the query', () => {
        expect(search(INDEX, '生活').kanji.map(k => k[0])).toEqual(['生']);
        expect(search(INDEX, '食生').kanji.map(k => k[0])).toEqual(['食', '生']);
    });

    it('finds grammar points by title, romaji and explanation, exact title first', () => {
        expect(search(INDEX, 'から').grammar.map(g => g[0])).toEqual(['g-kara', 'g-tekara']);
        expect(search(INDEX, 'kara').grammar.map(g => g[0])).toEqual(['g-kara', 'g-tekara']);
        expect(search(INDEX, 'te kara').grammar.map(g => g[0])).toEqual(['g-tekara']);
        expect(search(INDEX, 'after').grammar.map(g => g[0])).toEqual(['g-tekara']);
    });

    it('returns nothing for a blank query', () => {
        expect(search(INDEX, '   ')).toEqual({ query: '', kana: null, words: [], kanji: [], grammar: [] });
    });
});
