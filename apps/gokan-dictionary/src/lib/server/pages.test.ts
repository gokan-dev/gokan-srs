import { describe, expect, it } from 'vitest';
import type { GrammarPoint, Kanji, KanjiOrderId, Sentence, Vocabulary } from '@gokan/dataset-schema';
import { grammarPoint, kanji, sentence, vocabulary } from '../../test/fixtures';
import type { DictionaryData } from '../types';
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
        expect(pages.searchPage().document.noindex).toBe(true);
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
