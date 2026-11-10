import { describe, expect, it } from 'vitest';
import type { GrammarPoint, Kanji, KanjiOrderId, Sentence, Vocabulary } from '@gokan/dataset-schema';
import { grammarPoint, kanji, sentence, vocabulary } from '../../test/fixtures';
import type { DictionaryData, LocaleText } from '../types';
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
}

/** A Chinese text layer in which exactly `ids` have text shown. */
function chineseText(ids: readonly string[]): LocaleText {
    const shown = new Set(ids);
    return {
        language: 'zh-hans',
        wordText: id => Promise.resolve(shown.has(id)
            ? { definitions: [], equivalents: [{ text: '想', sources: [{ source: 'jawiktionary', ref: id }] }] }
            : null),
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
        localeText: world.chinese ? chineseText(world.chinese) : null,
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

    it('names the words it links that have a page in Chinese: the others link to English\'s', async () => {
        // 考える's page links 思う (Made of) and, in its sentence, 私 and 思う: only 思う has Chinese text.
        const chineseWorld: World = { ...world, sentences: { '1281390': [sentence()] }, chinese: ['1589350', '1281390'] };
        const page = await pagesOf(memorySource(chineseWorld).source, 'zh-hans').vocabPage('1281390');
        expect(page.props.wordsInLocale).toEqual(['1589350']);
    });

    it('has no kanji, grammar or list page yet: each a 404', async () => {
        const pages = pagesOf(memorySource(world).source, 'zh-hans');
        await expect(pages.kanjiPage('学')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.grammarPage('n2-169')).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.homePage()).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.vocabJlptPage(5, 1)).rejects.toBeInstanceOf(PageNotFound);
        await expect(pages.searchPage()).rejects.toBeInstanceOf(PageNotFound);
    });

    it('lists only its words with text, in its entries and its sitemap', async () => {
        const pages = pagesOf(memorySource(world).source, 'zh-hans');
        expect(await pages.pageEntries.vocab()).toEqual([{ id: '1589350' }]);
        expect(await pages.pageEntries.kanji()).toEqual([]);
        expect(await pages.pageEntries.vocabJlpt()).toEqual([]);
        expect(await pages.sitemapPaths()).toEqual([zhUrls.vocabPath('1589350')]);
    });

    it('keeps English\'s word page as it was: no text, no translations', async () => {
        const page = await pagesOf(memorySource(world).source, 'en').vocabPage('1589350');
        expect(Object.keys(page.props).sort()).toEqual(['components', 'parents', 'sentences', 'vocab']);
    });

    it('refuses a source not read in the locale\'s language', () => {
        expect(() => pagesOf(memorySource({ words: [omou] }).source, 'zh-hans')).toThrow(/need a source read in zh-hans/);
    });
});
