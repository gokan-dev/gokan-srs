import { describe, expect, it } from 'vitest';
import { GRAMMAR_TIER, matchesSearchWord, normalizeQuery, prepareSearch, readSearchQuery, runSearch, WORD_TIER } from './search';
import type { Deinflector, SearchGrammarInput, SearchKanjiInput, SearchWordInput } from './search';

type Word = { id: string; written: string; reading: string; gloss: string; kana?: boolean; jlpt?: boolean; common?: boolean; verb?: boolean };

/** A word as both apps hand one to the matcher: the shown form first (the kana, for a word learned in kana). */
const word = ({ id, written, reading, gloss, kana = false, jlpt, common, verb = false }: Word): SearchWordInput<string, 'ichidan'> => ({
    row: id,
    forms: kana ? [reading, written] : [written],
    reading,
    gloss,
    jlpt,
    common,
    wordClass: verb ? 'ichidan' : null,
});

const kanji = (character: string, meanings: string[], readings: string[], jlpt = 0, frequency = 0): SearchKanjiInput<string> =>
    ({ row: character, character, meanings, readings, jlpt, frequency });

const point = (id: string, title: string, romaji: string, explanation = ''): SearchGrammarInput<string> => ({ row: id, title, romaji, explanation });

/** In kanji-spelling order, as gokan-srs's index/search.json: compounds containing する come before 為る. */
const SPELLING_ORDER = prepareSearch<string, string, string>({ words: [
    word({ id: 'kigasuru', written: '気がする', reading: 'きがする', gloss: 'to have a feeling' }),
    word({ id: 'aisuru', written: '愛する', reading: 'あいする', gloss: 'to love' }),
    word({ id: 'suruga', written: '駿河', reading: 'するが', gloss: 'Suruga (province)' }),
    word({ id: 'kosuru', written: '擦る', reading: 'こする', gloss: 'to rub' }),
    word({ id: 'suru-rub', written: '擦る', reading: 'する', gloss: 'to rub; to strike' }),
    word({ id: 'suru-print', written: '刷る', reading: 'する', gloss: 'to print' }),
    word({ id: 'suru', written: '為る', reading: 'する', gloss: 'to do', kana: true }),
    word({ id: 'surume', written: '鯣', reading: 'するめ', gloss: 'dried squid' }),
] });

const spelling = (query: string) => runSearch(SPELLING_ORDER, query).words.map(hit => hit.row);

describe('normalizeQuery', () => {
    it('folds full-width Latin, trims, collapses spaces and lowercases', () => {
        expect(normalizeQuery('  ＴＡＢＥＲＵ ')).toBe('taberu');
        expect(normalizeQuery('to  eat')).toBe('to eat');
    });
});

describe('words, in an index not in frequency order', () => {
    it('puts the word shown as the query first, then exact readings, prefixes and substrings, shorter forms first', () => {
        expect(spelling('する')).toEqual(['suru', 'suru-rub', 'suru-print', 'suruga', 'surume', 'aisuru', 'kosuru', 'kigasuru']);
    });

    it('reads romaji as a reading, the word shown as its kana first', () => {
        expect(spelling('suru')).toEqual(['suru', 'suru-rub', 'suru-print', 'suruga', 'surume', 'kosuru', 'kigasuru', 'aisuru']);
    });

    it('finds a word learned in kana by its kanji spelling too', () => {
        expect(spelling('為る')).toEqual(['suru']);
    });

    it('keeps index order for an English query', () => {
        expect(spelling('to ')).toEqual(['kigasuru', 'aisuru', 'kosuru', 'suru-rub', 'suru-print', 'suru']);
    });

    it('ranks an exact kanji spelling, then words starting with it, then compounds containing it', () => {
        const index = prepareSearch<string, string, string>({ words: [
            word({ id: 'mainichi', written: '毎日', reading: 'まいにち', gloss: 'every day' }),
            word({ id: 'nichiyou', written: '日曜', reading: 'にちよう', gloss: 'Sunday' }),
            word({ id: 'hi', written: '日', reading: 'ひ', gloss: 'day' }),
        ] });
        expect(runSearch(index, '日').words).toEqual([
            { row: 'hi', tier: WORD_TIER.exact }, { row: 'nichiyou', tier: WORD_TIER.prefix }, { row: 'mainichi', tier: WORD_TIER.compound },
        ]);
    });

    it('ranks compounds with the words starting with the kanji in an index in frequency order', () => {
        // 先生 is more frequent than 生地: frequency, not prefix-ness, orders them.
        const index = prepareSearch<string, string, string>({ words: [
            word({ id: 'sensei', written: '先生', reading: 'せんせい', gloss: 'teacher' }),
            word({ id: 'kiji', written: '生地', reading: 'きじ', gloss: 'cloth' }),
            word({ id: 'sei', written: '生', reading: 'せい', gloss: 'life' }),
        ] }, { frequencyOrdered: true });
        expect(runSearch(index, '生').words).toEqual([
            { row: 'sei', tier: WORD_TIER.exact }, { row: 'sensei', tier: WORD_TIER.prefix }, { row: 'kiji', tier: WORD_TIER.prefix },
        ]);
    });

    it('keeps a word while its romaji is typed partway through a syllable', () => {
        const index = prepareSearch<string, string, string>({ words: [
            word({ id: 'tabemono', written: '食べ物', reading: 'たべもの', gloss: 'food' }),
            word({ id: 'taberu', written: '食べる', reading: 'たべる', gloss: 'to eat' }),
            word({ id: 'benkyou', written: '勉強', reading: 'べんきょう', gloss: 'study' }),
            word({ id: 'chotto', written: '一寸', reading: 'ちょっと', gloss: 'a little', kana: true }),
        ] });
        const first = (query: string) => runSearch(index, query).words[0]?.row;
        expect(['tabe', 'taber', 'taberu', 'benky', 'chot'].map(first)).toEqual(['taberu', 'taberu', 'taberu', 'benkyou', 'chotto']);
    });

    it('ranks an English whole word in the gloss before a reading the romaji only starts, and a gloss substring after', () => {
        const index = prepareSearch<string, string, string>({ words: [
            word({ id: 'kara', written: '空', reading: 'から', gloss: 'empty' }),
            word({ id: 'kariru', written: '借りる', reading: 'かりる', gloss: 'to borrow' }),
            word({ id: 'houseki', written: '宝石', reading: 'ほうせき', gloss: 'gem; jewel' }),
            word({ id: 'cart', written: '荷車', reading: 'にぐるま', gloss: 'cart' }),
            word({ id: 'car', written: '車', reading: 'くるま', gloss: 'car; automobile' }),
            word({ id: 'ie', written: '家', reading: 'いえ', gloss: 'house; residence' }),
            word({ id: 'okara', written: '雪花菜', reading: 'おから', gloss: 'okara (soy pulp)' }),
        ] });
        const ranked = (query: string) => runSearch(index, query).words.map(hit => hit.row);
        expect(ranked('car')).toEqual(['car', 'cart']);
        expect(ranked('house')).toEqual(['ie', 'houseki']);
        expect(ranked('kar')).toEqual(['kara', 'kariru', 'okara']);
    });

    it('does not read a Japanese query against English glosses', () => {
        const index = prepareSearch<string, string, string>({ words: [word({ id: 'hanashi', written: '話', reading: 'はなし', gloss: 'talk about する' })] });
        expect(runSearch(index, 'する').words).toEqual([]);
    });

    it('reads romaji as an IME does: spaces dropped, \' after n, - as ー', () => {
        const index = prepareSearch<string, string, string>({ words: [
            word({ id: 'kani', written: '蟹', reading: 'かに', gloss: 'crab' }),
            word({ id: 'kan-i', written: '簡易', reading: 'かんい', gloss: 'simple; easy' }),
            word({ id: 'coffee', written: '珈琲', reading: 'コーヒー', gloss: 'coffee', kana: true }),
        ] });
        const first = (query: string) => runSearch(index, query).words[0]?.row;
        expect([`kan'i`, 'kani', 'ko-hi-', 'ko-h', 'こーひー'].map(first)).toEqual(['kan-i', 'kani', 'coffee', 'coffee', 'coffee']);
        expect(runSearch(index, "kan'i").kana).toBe('かんい');
    });
});

describe('words, in an index in frequency order', () => {
    const deinflector: Deinflector<'ichidan'> = {
        candidates: text => (text.endsWith('た') ? [{ form: `${text.slice(0, -1)}る`, wordClass: 'ichidan' }] : []),
        fits: (wordClass, rule) => wordClass === rule,
    };
    const index = prepareSearch<string, string, string, 'ichidan'>({ words: [
        word({ id: 'shokuji', written: '食事', reading: 'しょくじ', gloss: 'meal; eating', jlpt: true, common: true }),
        word({ id: 'taberu', written: '食べる', reading: 'たべる', gloss: 'to eat', jlpt: true, common: true, verb: true }),
        word({ id: 'kuu', written: '食う', reading: 'くう', gloss: 'to eat', common: true }),
        word({ id: 'great', written: '偉大', reading: 'いだい', gloss: 'great', common: true }),
    ] }, { frequencyOrdered: true, deinflector });
    const ids = (query: string) => runSearch(index, query).words.map(hit => hit.row);

    it('ranks an equal English sense above a gloss that only contains the query, JLPT words first', () => {
        expect(runSearch(index, 'eat').words.map(hit => [hit.row, hit.tier])).toEqual([
            ['taberu', WORD_TIER.sense], ['kuu', WORD_TIER.sense], ['shokuji', WORD_TIER.substring], ['great', WORD_TIER.substring],
        ]);
    });

    it('keeps frequency order within a tier, whatever the length', () => {
        expect(ids('食')).toEqual(['shokuji', 'taberu', 'kuu']);
    });

    it('finds the dictionary form of a conjugated query, naming the form typed', () => {
        expect(runSearch(index, '食べた').words[0]).toEqual({ row: 'taberu', tier: WORD_TIER.deinflected, via: '食べた' });
        expect(ids('tabeta')).toEqual(['taberu']);
    });
});

describe('words, in an index of Chinese glosses', () => {
    const index = prepareSearch<string, string, string>({ words: [
        word({ id: 'taberu', written: '食べる', reading: 'たべる', gloss: '吃，食' }),
        word({ id: 'shokuji', written: '食事', reading: 'しょくじ', gloss: '吃饭；饭食' }),
        word({ id: 'benkyou', written: '勉強', reading: 'べんきょう', gloss: '(在学校)学习、用功。' }),
    ] }, { glosses: 'zh-hans' });

    it('matches a Chinese query against the glosses, a whole gloss first', () => {
        expect(runSearch(index, '吃').words).toEqual([{ row: 'taberu', tier: WORD_TIER.sense }, { row: 'shokuji', tier: WORD_TIER.substring }]);
        expect(runSearch(index, '学习').words).toEqual([{ row: 'benkyou', tier: WORD_TIER.sense }]);
    });

    it('does not read English against Chinese glosses', () => {
        expect(runSearch(index, 'eat').words).toEqual([]);
    });
});

describe('kanji', () => {
    const index = prepareSearch<string, string, string>({ words: [word({ id: 'mizu', written: '水', reading: 'みず', gloss: 'water' })], kanji: [
        kanji('推', ['conjecture', 'infer'], ['スイ', 'お.す'], 2, 900),
        kanji('吹', ['blow', 'breathe'], ['スイ', 'ふ.く'], 3, 1200),
        kanji('水', ['water'], ['スイ', 'みず', 'みず-'], 5, 9201),
        kanji('学', ['study', 'learning', 'science'], ['ガク', 'まな.ぶ'], 5, 5839),
        kanji('瑞', ['congratulations'], ['ズイ', 'みず-'], 0, 0),
        kanji('泉', ['spring', 'fountain'], ['セン', 'いずみ'], 3, 3000),
    ] });
    const found = (query: string) => runSearch(index, query).kanji;

    it('finds a kanji by its character, its meaning, and its readings in kana or romaji', () => {
        expect(found('水')[0]).toBe('水');
        expect(found('water')).toEqual(['水']);
        expect(found('みず')).toEqual(['水', '瑞']);
        expect(found('すい')).toEqual(['水', '吹', '推']);
        expect(found('スイ')).toEqual(['水', '吹', '推']);
        expect(found('sui')).toEqual(['水', '吹', '推']);
        expect(found('mizu')).toEqual(['水', '瑞']);
    });

    it('reads a kun reading with and without its okurigana', () => {
        expect(found('まなぶ')).toEqual(['学']);
        expect(found('manabu')).toEqual(['学']);
        expect(found('まな')).toEqual(['学']);
    });

    it('ranks an equal meaning above a meaning containing the query as a word', () => {
        expect(found('spring')).toEqual(['泉']);
        expect(found('learning')).toEqual(['学']);
        expect(found('learn')).toEqual([]);
    });

    it('lists the kanji of a query in its order', () => {
        expect(found('学水')).toEqual(['学', '水']);
    });

    it('shows the kanji group first for a single kanji, the words first otherwise', () => {
        expect(runSearch(index, '水').groups).toEqual(['kanji', 'words', 'grammar']);
        expect(runSearch(index, 'mizu').groups).toEqual(['words', 'kanji', 'grammar']);
        expect(runSearch(index, 'mizu').words.map(hit => hit.row)).toEqual(['mizu']);
    });
});

describe('grammar', () => {
    const index = prepareSearch<string, string, string>({ words: [], grammar: [
        point('kara', 'から', 'kara', 'Because; since.'),
        point('tekara', 'Verb てから～', '〜te kara', 'Express a sequence of actions; \'after\'.'),
        point('te-de', 'て-form: な-Adjective で', '', 'The connective で that joins clauses.'),
        point('masu', 'Polite present: Verb ます', '', 'The polite non-past form.'),
    ] });
    const found = (query: string) => runSearch(index, query).grammar;

    it('finds a point by its title, with or without placeholders, its romaji and its kana', () => {
        expect(found('てから')).toEqual(['tekara']);
        expect(found('～てから')).toEqual(['tekara']);
        expect(found('te kara')).toEqual(['tekara']);
        expect(found('tekara')).toEqual(['tekara']);
        expect(found('から')).toEqual(['kara', 'tekara']);
        expect(found('kara')).toEqual(['kara', 'tekara']);
        expect(found('ます')).toEqual(['masu']);
    });

    it('finds a point by words of its title read in romaji, then by a word of its explanation', () => {
        expect(found('te form')).toEqual(['te-de']);
        expect(found('masu')).toEqual(['masu']);
        expect(found('after')).toEqual(['tekara']);
    });

    it('shows the grammar group first when the query is a title', () => {
        expect(runSearch(index, 'てから').groups).toEqual(['grammar', 'words', 'kanji']);
        expect(runSearch(index, 'after').groups).toEqual(['words', 'kanji', 'grammar']);
    });

    it('ranks an exact title above a title containing the query', () => {
        const index2 = prepareSearch<string, string, string>({ words: [], grammar: [point('a', '～ことから', '〜koto kara'), point('b', 'から', 'kara')] });
        expect(runSearch(index2, 'から').grammar).toEqual(['b', 'a']);
        expect(GRAMMAR_TIER.exact).toBeLessThan(GRAMMAR_TIER.contains);
    });
});

describe('matchesSearchWord', () => {
    const taberu = word({ id: 'taberu', written: '食べる', reading: 'たべる', gloss: 'to eat' });
    const matches = (query: string) => {
        const read = readSearchQuery(query);
        return read !== null && matchesSearchWord(taberu, read);
    };

    it('keeps a word the search would find: written form, reading, romaji typed partway, gloss', () => {
        expect(['食べ', 'べる', 'tabe', 'taber', 'tabe ru', 'eat'].map(matches)).toEqual([true, true, true, true, true, true]);
    });

    it('drops a word the query does not reach', () => {
        expect(['tabo', 'drink', '飲'].map(matches)).toEqual([false, false, false]);
    });
});

describe('a blank query', () => {
    it('finds nothing', () => {
        expect(runSearch(SPELLING_ORDER, '   ')).toEqual({ query: '', kana: null, words: [], kanji: [], grammar: [], groups: ['words', 'kanji', 'grammar'] });
        expect(readSearchQuery(' ')).toBeNull();
    });
});
