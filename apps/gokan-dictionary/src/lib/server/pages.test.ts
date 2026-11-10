import { describe, expect, it } from 'vitest';
import type { GrammarPoint, Kanji, KanjiOrderId, Sentence, Vocabulary } from '@gokan/dataset-schema';
import { grammarPoint, kanji, sentence, vocabulary, wordText } from '../../test/fixtures';
import type { DictionaryData, LocaleText, WordText } from '../types';
import { LOCAL_GLOSS_LENGTH, shortWordTextSummary, wordTextSummary } from '../senses';
import { grammarSummaryOf } from '../grammarBrowse';
import { vocabSummaryFrom } from '../vocabSummary';
import { kanjiOrderSlug, localeUrls } from '../urls';
import { PageNotFound, pagesOf } from './pages';

const urls = localeUrls('en');

interface World {
    words: Vocabulary[];
    sentences?: Record<string, Sentence[]>;
    kanji?: Kanji[];
    points?: GrammarPoint[];
    /** JLPT level -> word ids, frequency-ordered. */
    jlpt?: Record<number, string[]>;
    /** Every word id, most frequent first; defaults to the words' order. */
    frequency?: string[];
    /** Read in Chinese: the words with Chinese text shown (each a shown equivalent), the others none. */
    chinese?: string[];
    /** A Chinese word's own text, in place of the equivalent 想. */
    chineseTexts?: Record<string, WordText>;
}

/**
 * A Chinese text layer in which exactly `ids` have text shown: each the equivalent 想, or the text
 * `texts` gives it.
 */
function chineseText(ids: readonly string[], texts: Readonly<Record<string, WordText>> = {}): LocaleText {
    const shown = new Set(ids);
    const textOf = (id: string): WordText | null => (shown.has(id)
        ? texts[id] ?? { definitions: [], equivalents: [{ text: '想', sources: [{ source: 'jawiktionary', ref: id }] }] }
        : null);
    return {
        language: 'zh-hans',
        wordText: id => Promise.resolve(textOf(id)),
        wordSummary: id => {
            const text = textOf(id);
            return Promise.resolve(text === null ? null : shortWordTextSummary(text));
        },
        searchGloss: id => {
            const text = textOf(id);
            return Promise.resolve(text === null ? null : wordTextSummary(text));
        },
        withPages: other => Promise.resolve(other.filter(id => shown.has(id))),
        wordIds: () => Promise.resolve([...ids]),
        firstWordId: () => Promise.resolve(ids.at(0) ?? null),
        sentenceTranslations: () => Promise.resolve(new Map()),
    };
}

/** A DictionaryData held in memory, counting how often each method is asked. */
function memorySource(world: World): { source: DictionaryData; calls: Map<string, number> } {
    const calls = new Map<string, number>();
    const count = (name: string) => calls.set(name, (calls.get(name) ?? 0) + 1);
    const byId = new Map(world.words.map(word => [word.id, word]));
    const points = new Map((world.points ?? []).map(point => [point.id, point]));
    const entry = (id: string) => ({ id, containedKanji: [] });
    const ask = <T>(name: string, value: () => T): Promise<T> => {
        count(name);
        return Promise.resolve().then(value);
    };
    const source: DictionaryData = {
        vocabIds: () => ask('vocabIds', () => world.words.map(word => word.id)),
        vocab: id => ask('vocab', () => {
            const word = byId.get(id);
            if (word === undefined) throw new Error(`no vocab ${id}`);
            return word;
        }),
        sentencesFor: id => ask('sentencesFor', () => world.sentences?.[id] ?? null),
        wordSummaries: () => ask('wordSummaries', () => new Map(world.words.map(word => [word.id, vocabSummaryFrom(word)]))),
        grammarSummaries: () => ask('grammarSummaries', () => new Map([...points.values()].map(point => [point.id, grammarSummaryOf(point)]))),
        kanjiList: () => ask('kanjiList', () => world.kanji ?? []),
        kanjiVocabIndex: () => ask('kanjiVocabIndex', () => ({})),
        kanjiOrder: (_order: KanjiOrderId) => ask('kanjiOrder', () => (world.kanji ?? []).map(entry => entry.character)),
        vocabJlptIndex: () => ask('vocabJlptIndex', () => Object.fromEntries(Object.entries(world.jlpt ?? {}).map(([level, ids]) => [level, ids.map(entry)]))),
        frequencyIndex: () => ask('frequencyIndex', () => (world.frequency ?? world.words.map(word => word.id)).map(entry)),
        grammarIds: () => ask('grammarIds', () => [...points.keys()]),
        grammarPoint: id => ask('grammarPoint', () => {
            const point = points.get(id);
            if (point === undefined) throw new Error(`no point ${id}`);
            return point;
        }),
        grammarTeachingOrder: () => ask('grammarTeachingOrder', () => ({ order: [...points.keys()], chapters: [] })),
        grammarContrasts: () => ask('grammarContrasts', () => ({})),
        grammarVariantGroups: () => ask('grammarVariantGroups', () => ({})),
        grammarConjugations: () => ask('grammarConjugations', () => ({})),
        grammarMinedExamples: _id => ask('grammarMinedExamples', () => null),
        localeText: world.chinese ? chineseText(world.chinese, world.chineseTexts) : null,
    };
    return { source, calls };
}

const omou = vocabulary();
const kangaeru = vocabulary({ id: '1281390', writtenForm: { kanji: '考える', alternatives: [], containedKanji: ['考'] }, components: ['1589350', '9999999'] });

describe('pagesOf: entity pages', () => {
    it('builds a word page from its source, its related words resolved and an id with no word left out', async () => {
        const pages = pagesOf(memorySource({ words: [omou, kangaeru] }).source, 'en');
        const page = await pages.vocabPage('1281390');
        expect(page.props.components.map(summary => summary.id)).toEqual(['1589350']);
        expect(page.document).toMatchObject({ canonicalPath: urls.vocabPath('1281390'), style: 'vocab' });
        expect(page.document.structuredData).toMatchObject({ '@type': 'DefinedTerm', name: '考える' });
    });

    it('is a PageNotFound for a word, kanji or point the source does not have', async () => {
        const pages = pagesOf(memorySource({ words: [omou], kanji: [kanji()], points: [grammarPoint()] }).source, 'en');
        await expect(pages.vocabPage('9999999')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.kanjiPage('猫')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.grammarPage('n5-999')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.kanjiOrderPage('no-such-order')).rejects.toBeInstanceOf(PageNotFound);
    });

    it('builds the indexes pages share once, however many pages ask', async () => {
        const { source, calls } = memorySource({ words: [omou, kangaeru], kanji: [kanji()] });
        const pages = pagesOf(source, 'en');
        await Promise.all([pages.vocabPage('1589350'), pages.vocabPage('1281390'), pages.kanjiPage('学'), pages.vocabIndexPage()]);
        expect(calls.get('wordSummaries')).toBe(1);
        expect(calls.get('vocabIds')).toBe(1);
        expect(calls.get('kanjiList')).toBe(1);
    });

    it('retries an index whose read failed, rather than failing every later page', async () => {
        const { source } = memorySource({ words: [omou] });
        const summaries = () => source.wordSummaries();
        let failed = false;
        const flaky = {
            ...source,
            wordSummaries: () => {
                if (failed) return summaries();
                failed = true;
                return Promise.reject(new Error('503 from CloudFront'));
            },
        };
        const pages = pagesOf(flaky, 'en');
        await expect(pages.vocabPage('1589350')).rejects.toThrow('503');
        expect((await pages.vocabPage('1589350')).document.canonicalPath).toBe(urls.vocabPath('1589350'));
    });
});

describe('pagesOf: list pages', () => {
    it('pages a JLPT list, with no page past the last', async () => {
        const pages = pagesOf(memorySource({ words: [omou, kangaeru], jlpt: { 5: ['1589350', '1281390'] } }).source, 'en');
        const first = await pages.vocabJlptPage(5, 1);
        expect(first.props.words.map(word => word.id)).toEqual(['1589350', '1281390']);
        expect(first.props.allLevels).toEqual([5]);
        await expect(pages.vocabJlptPage(5, 2)).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.vocabJlptPage(4, 1)).rejects.toBeInstanceOf(PageNotFound);
    });

    it('counts every word\'s sentences on the home page', async () => {
        const pages = pagesOf(memorySource({ words: [omou, kangaeru], sentences: { '1589350': [sentence(), sentence({ id: 's2' })], '1281390': [sentence({ id: 's3' })] } }).source, 'en');
        expect((await pages.homePage()).props.sentenceCount).toBe(3);
    });

    it('marks the search page noindex and gives the grammar index its filter script', async () => {
        const pages = pagesOf(memorySource({ words: [omou], points: [grammarPoint()] }).source, 'en');
        expect((await pages.searchPage()).document.noindex).toBe(true);
        expect((await pages.grammarIndexPage()).document).toMatchObject({ canonicalPath: urls.grammarIndexPath(), style: 'grammarIndex', script: 'grammarFilter' });
    });
});

describe('pagesOf: the catalog', () => {
    const world: World = { words: [omou, kangaeru], kanji: [kanji()], points: [grammarPoint()], jlpt: { 5: ['1589350'] } };

    it('lists every value of each route\'s parameters', async () => {
        const { pageEntries } = pagesOf(memorySource(world).source, 'en');
        expect(await pageEntries.vocab()).toEqual([{ id: '1589350' }, { id: '1281390' }]);
        expect(await pageEntries.kanji()).toEqual([{ character: '学' }]);
        expect(await pageEntries.grammar()).toEqual([{ id: 'n2-169' }]);
        expect(await pageEntries.vocabJlpt()).toEqual([{ level: '5' }]);
        // The first page of a list is the level's own route; only later pages are numbered.
        expect(await pageEntries.vocabJlptPage()).toEqual([]);
        expect((await pageEntries.kanjiOrder()).map(entry => entry.order)).toContain(kanjiOrderSlug('kklc'));
        expect(await pageEntries.kanjiRange()).toContainEqual({ order: kanjiOrderSlug('kklc'), range: '1-1' });
    });

    it('lists the sitemap home first, every word, kanji and point, the list pages, and never the search page', async () => {
        const paths = await pagesOf(memorySource(world).source, 'en').sitemapPaths();
        expect(paths[0]).toBe(urls.homePath());
        expect(paths.slice(1, 4)).toEqual([urls.vocabPath('1589350'), urls.vocabPath('1281390'), urls.kanjiPath('学')]);
        expect(paths).toContain(urls.kanjiIndexPath());
        expect(paths).toContain(urls.vocabJlptPath(5));
        expect(paths.at(-1)).toBe(urls.vocabIndexPath());
        expect(paths.some(path => path.includes('/search/'))).toBe(false);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('builds the search index in frequency order, leaving out an id with no word', async () => {
        const pages = pagesOf(memorySource({ ...world, frequency: ['1281390', '0000000', '1589350'] }).source, 'en');
        const { core } = await pages.searchIndex();
        expect(core.w[0]).toEqual(['1281390', '1589350']);
    });
});

describe('pagesOf: a locale other than English', () => {
    const world: World = { words: [omou, kangaeru], kanji: [kanji()], points: [grammarPoint()], jlpt: { 5: ['1589350'] }, chinese: ['1589350'] };
    const zhUrls = localeUrls('zh-hans');

    it('has a page for a word with Chinese text shown, and none (404) for a word without', async () => {
        const pages = pagesOf(memorySource(world).source, 'zh-hans');
        const page = await pages.vocabPage('1589350');
        expect(page.props.text?.equivalents).toEqual([{ text: '想', sources: [{ source: 'jawiktionary', ref: '1589350' }] }]);
        expect(page.document).toMatchObject({ locale: 'zh-hans', canonicalPath: zhUrls.vocabPath('1589350') });
        await expect(pages.vocabPage('1281390')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.vocabPage('9999999')).rejects.toBeInstanceOf(PageNotFound);
    });

    it('links only the words with a page in Chinese: its lists leave the others out, its sentences show them unlinked', async () => {
        // 考える's page links 思う (Made of) and, in its sentence, 私 and 思う. With Chinese text on
        // 考える alone, 思う leaves Made of, and its sentence shows 思う and 私 unlinked.
        const chineseWorld: World = { ...world, sentences: { '1281390': [sentence()] }, chinese: ['1281390'] };
        const page = await pagesOf(memorySource(chineseWorld).source, 'zh-hans').vocabPage('1281390');
        expect(page.props.components).toEqual([]);
        expect(page.props.withoutPage).toEqual({ words: ['1311110', '1589350'], kanji: ['考'] });
        const linked = await pagesOf(memorySource({ ...chineseWorld, chinese: ['1589350', '1281390'] }).source, 'zh-hans').vocabPage('1281390');
        expect(linked.props.components.map(word => [word.id, word.localGloss])).toEqual([['1589350', '想']]);
        expect(linked.props.withoutPage?.words).toEqual(['1311110']);
    });

    it('cuts a row\'s Chinese gloss short, as English cuts its own', async () => {
        // A word with no equivalents is summarised by its first definition sense: here a long one.
        const long = wordText({ equivalents: [], definitions: [{ ...wordText().definitions[0], senses: [{ glosses: ['表示动作的方向', '表示状态的变化或结果', '用于句末表示强调的语气'] }] }] });
        const pages = pagesOf(memorySource({ ...world, jlpt: { 5: ['1589350'] }, chinese: ['1589350'], chineseTexts: { '1589350': long } }).source, 'zh-hans');
        const [row] = (await pages.vocabJlptPage(5, 1)).props.words;
        expect(row?.localGloss).toBe('表示动作的方向；表示状态的变化或结果');
        expect(row?.localGloss?.length).toBeLessThanOrEqual(LOCAL_GLOSS_LENGTH);
    });

    it('titles a word page with its meaning in Chinese', async () => {
        const page = await pagesOf(memorySource(world).source, 'zh-hans').vocabPage('1589350');
        expect(page.document.title).toMatch(/^思う（おもう）的中文意思：想/);
        expect(page.document.key).toEqual({ type: 'vocab', id: '1589350' });
    });

    it('has no kanji or grammar page yet: each a 404, as its search page', async () => {
        const pages = pagesOf(memorySource(world).source, 'zh-hans');
        await expect(pages.kanjiPage('学')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.grammarPage('n2-169')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.kanjiIndexPage()).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.grammarIndexPage()).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.searchPage()).rejects.toBeInstanceOf(PageNotFound);
    });

    it('has its home and vocabulary lists, of its words with text only', async () => {
        const pages = pagesOf(memorySource({ ...world, jlpt: { 5: ['1589350', '1281390'], 4: ['1281390'] } }).source, 'zh-hans');
        const list = await pages.vocabJlptPage(5, 1);
        expect(list.props.words.map(word => word.id)).toEqual(['1589350']);
        // Each row with its gloss in Chinese, for its list to show in place of English's.
        expect(list.props.words[0]?.localGloss).toBe('想');
        expect(list.props.allLevels).toEqual([5]);
        await expect(pages.vocabJlptPage(4, 1)).rejects.toBeInstanceOf(PageNotFound);
        const index = await pages.vocabIndexPage();
        expect(index.props).toEqual({ levels: [{ level: 5, count: 1 }], totalCount: 1 });
        expect(index.document.canonicalPath).toBe(zhUrls.vocabIndexPath());
        const home = await pages.homePage();
        expect(home.props.vocabCount).toBe(1);
        expect(home.props.featured.map(word => word.id)).toEqual(['1589350']);
        expect(home.document).toMatchObject({ locale: 'zh-hans', canonicalPath: zhUrls.homePath(), key: { type: 'home' } });
    });

    it('lists only its pages, in its entries and its sitemap', async () => {
        const pages = pagesOf(memorySource(world).source, 'zh-hans');
        expect(await pages.pageEntries.vocab()).toEqual([{ id: '1589350' }]);
        expect(await pages.pageEntries.kanji()).toEqual([]);
        expect(await pages.pageEntries.vocabJlpt()).toEqual([{ level: '5' }]);
        expect(await pages.pageEntries.home()).toEqual([{}]);
        expect(await pages.sitemapPaths()).toEqual([zhUrls.homePath(), zhUrls.vocabPath('1589350'), zhUrls.vocabJlptPath(5), zhUrls.vocabIndexPath()]);
    });

    it('says which of its pages exist, as a page in another locale asks for its counterpart', async () => {
        const [chinese, english] = [pagesOf(memorySource(world).source, 'zh-hans'), pagesOf(memorySource(world).source, 'en')];
        expect(await chinese.servesPage({ type: 'vocab', id: '1589350' })).toBe(true);
        expect(await chinese.servesPage({ type: 'vocab', id: '1281390' })).toBe(false);
        expect(await english.servesPage({ type: 'vocab', id: '1281390' })).toBe(true);
        expect(await english.servesPage({ type: 'vocab', id: '9999999' })).toBe(false);
        expect(await chinese.servesPage({ type: 'vocabJlpt', level: 5, page: 1 })).toBe(true);
        expect(await chinese.servesPage({ type: 'vocabJlpt', level: 5, page: 2 })).toBe(false);
        expect(await chinese.servesPage({ type: 'vocabJlpt', level: 4, page: 1 })).toBe(false);
        expect(await chinese.servesPage({ type: 'home' })).toBe(true);
    });

    it('keeps English\'s word page as it was: no text, no translations', async () => {
        const page = await pagesOf(memorySource(world).source, 'en').vocabPage('1589350');
        expect(Object.keys(page.props).sort()).toEqual(['components', 'parents', 'sentences', 'vocab']);
    });

    it('refuses a source not read in the locale\'s language', () => {
        expect(() => pagesOf(memorySource({ words: [omou] }).source, 'zh-hans')).toThrow(/need a source read in zh-hans/);
    });
});
