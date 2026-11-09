// Every page's props and document, built from the data it is given: what each route's `load`
// returns, and the catalog of every page (the routes' prerender entries and the sitemap). Two
// halves, as the site is served: `entityPagesOf` builds a word, kanji or grammar point page from
// EntityData alone (the source a page rendered on request has, over HTTP), and `pagesOf` adds the
// list pages and the catalog, which need the whole dataset (DictionaryData, the checkout, at
// build). The indexes several pages share are built once per source and kept, so 40k pages do not
// rebuild them. Pure of I/O but what the source does: the source is chosen in dictionary.ts, the
// asset hrefs added by the server hook, so this runs on fixtures in a test.

import { headwordOf, JLPT_LEVELS, KANJI_ORDERS, kanjiStepIndex } from '@gokan/dataset-schema';
import type { GrammarPoint, Kanji, KanjiOrder, KanjiOrderId, KanjiOrderList } from '@gokan/dataset-schema';
import { buildChapterIndexRows, buildChapterLocatorIndex } from '../grammarChapters';
import { conjugationTables } from '../grammarConjugations';
import { buildFamilyPages } from '../grammarFamilies';
import { grammarSummaryOf, groupByLevel, inTeachingOrder } from '../grammarBrowse';
import { buildVariantSiblings } from '../grammarVariants';
import { kanjiRanges, WORDS_PER_KANJI, type KanjiRange } from '../kanjiOrders';
import { JLPT_PAGE_SIZE, paginate } from '../pagination';
import { searchGrammarRow, searchKanjiRow, searchWordRow, splitSearchIndex } from '../searchIndex';
import { datasetLanguageOf, DEFAULT_LOCALE, type ServedLocale } from '../locale';
import { messagesFor, type PageMeta } from '../messages';
import { orderSentences } from '../sentenceOrder';
import type { DictionaryData, EntityData, GrammarSummary, LocaleText, SearchIndexFile, SearchWordRow, VocabSummary, WordText } from '../types';
import { kanjiOrderSlug, kanjiRangeSlug, localeUrls } from '../urls';
import type { PageScript, PageStyle } from './assets';
import { kept } from './kept';
import { sentenceTranslationsOf } from './localeText';
import type {
    GrammarChapterPageProps, GrammarChaptersIndexPageProps, GrammarConjugationsIndexPageProps, GrammarFamiliesIndexPageProps, GrammarFamilyPageProps, GrammarIndexPageProps, GrammarPageProps, HomePageProps, KanjiIndexPageProps, KanjiOrderPageProps, KanjiOrdersPageProps, KanjiPageProps, KanjiRangePageProps, VocabIndexPageProps, VocabJlptPageProps, VocabPageProps,
} from '../pageProps';

// Pools go up to 60 sentences across 477 points (see gokan-dataset's Corpus-mined sentences
// note): capped here to bound page size.
const MAX_MINED_EXAMPLES = 25;
/** Common N5 words on the home page. */
const FEATURED_WORDS = 12;

/**
 * What a page decides about its document: everything but its body and what every page links (the
 * shared stylesheet, the search script, analytics). Its stylesheet and script by name; the server
 * hook resolves them to the built files.
 */
export interface PageDocument {
    /** The page's language: <html lang>. */
    locale: ServedLocale;
    title: string;
    description: string;
    /** Site-relative, with the base path: the canonical link and og:url. */
    canonicalPath: string;
    style?: PageStyle;
    script?: PageScript;
    structuredData?: object;
    noindex?: boolean;
}

/** What a page builder returns: its page component's props, and the document around them. */
export interface Rendered<Props> {
    props: Props;
    document: PageDocument;
}

/** A page that could not be built from what was asked: an unknown id, or a page past the last. */
export class PageNotFound extends Error {}

/** The document of a page that could not be shown (ErrorPage.svelte): never indexed. */
export function errorDocument(status: number, pathname: string, locale: ServedLocale): PageDocument {
    const meta = messagesFor(locale).meta.error(status);
    return { locale, title: meta.title, description: meta.description, canonicalPath: pathname, noindex: true };
}

/** What a locale's pages are written with: its paths, its titles and descriptions, and its documents. */
function writtenIn(locale: ServedLocale) {
    return {
        urls: localeUrls(locale),
        meta: messagesFor(locale).meta,
        documentOf: (canonicalPath: string, meta: PageMeta, options: Pick<PageDocument, 'style' | 'script' | 'structuredData' | 'noindex'> = {}): PageDocument => (
            { locale, title: meta.title, description: meta.description, canonicalPath, ...options }
        ),
    };
}

/** Resolves related-vocab ids to summaries; an id with no word file is left out. */
function resolveSummaries(ids: readonly string[], summaryById: ReadonlyMap<string, VocabSummary>): VocabSummary[] {
    return ids.map(id => summaryById.get(id)).filter((summary): summary is VocabSummary => summary !== undefined);
}

/**
 * The text layer a locale's pages read: none for English, whose text every value already carries;
 * another locale's from its source, which must be read in its language.
 */
function localeTextOf(source: EntityData, locale: ServedLocale): LocaleText | null {
    if (locale === DEFAULT_LOCALE) return null;
    if (source.localeText?.language !== datasetLanguageOf(locale)) throw new Error(`[pages] ${locale}'s pages need a source read in ${datasetLanguageOf(locale)}.`);
    return source.localeText;
}

/**
 * Which pages a locale has: English every page; another locale its word pages only, so far (#170:
 * kanji, grammar and list pages are not in its first sprint, and a URL for one answers 404). Wraps a
 * page builder so it is a PageNotFound outside English.
 */
function pagesInEnglishOnly(locale: ServedLocale) {
    return <Args extends unknown[], Page>(build: (...args: Args) => Page | Promise<Page>) => async (...args: Args): Promise<Page> => {
        if (locale !== DEFAULT_LOCALE) throw new PageNotFound(`no ${locale} page here yet: only its word pages are served`);
        return build(...args);
    };
}

/** The indexes an entity page reads, each built on first use and kept for the source. */
function entityIndexesOf(source: EntityData) {
    const kanjiList = kept(async () => source.kanjiList());
    return {
        summaries: kept(async () => source.wordSummaries()),
        grammarSummaries: kept(async () => source.grammarSummaries()),
        kanjiList,
        kanjiByCharacter: kept(async (): Promise<ReadonlyMap<string, Kanji>> => new Map((await kanjiList()).map(kanji => [kanji.character, kanji]))),
        kanjiVocabIndex: kept(async () => source.kanjiVocabIndex()),
        kanjiOrderLists: kept(async () => Promise.all(KANJI_ORDERS.map(async order => ({ order, list: await source.kanjiOrder(order.id) })))),
        grammarIndexes: kept(async () => {
            const [teachingOrder, variantGroups, conjugationIndex] = await Promise.all([
                source.grammarTeachingOrder(), source.grammarVariantGroups(), source.grammarConjugations(),
            ]);
            return { teachingOrder, variantGroups, conjugationIndex, chapterLocatorIndex: buildChapterLocatorIndex(teachingOrder) };
        }),
    };
}

type EntityIndexes = ReturnType<typeof entityIndexesOf>;

/** The pages rendered on request: a word, a kanji, a grammar point. */
export type EntityPages = ReturnType<typeof entityPagesOf>;

/**
 * The entity pages over one source. Whether an entity exists, and what a page lists of other
 * entries, come from the summary indexes (every word, every grammar point), never from reading
 * every file: a page rendered on request reads its own entity's files and those indexes only.
 */
export function entityPagesOf(source: EntityData, locale: ServedLocale, indexes: EntityIndexes = entityIndexesOf(source)) {
    const { summaries, grammarSummaries, kanjiByCharacter, kanjiVocabIndex, kanjiOrderLists, grammarIndexes } = indexes;
    const { urls, meta, documentOf } = writtenIn(locale);

    const text = localeTextOf(source, locale);

    /** The page's text in the locale's language, or null for English: a word without any has no page in it. */
    async function wordTextOf(id: string): Promise<{ text: LocaleText; word: WordText } | null> {
        if (text === null) return null;
        const word = await text.wordText(id);
        if (word === null) throw new PageNotFound(`no ${locale} text shown for word ${id}`);
        return { text, word };
    }

    async function vocabPage(id: string): Promise<Rendered<VocabPageProps>> {
        const summaryById = await summaries();
        if (!summaryById.has(id)) throw new PageNotFound(`no word ${id}`);
        const localized = await wordTextOf(id);
        const [vocab, allSentences, translations] = await Promise.all([
            source.vocab(id), source.sentencesFor(id), localized?.text.sentenceTranslations(id),
        ]);
        const vocabMeta = meta.vocab(vocab);
        const sentences = orderSentences(allSentences ?? [], id, headwordOf(vocab));
        return {
            props: {
                vocab,
                components: resolveSummaries(vocab.components ?? [], summaryById),
                parents: resolveSummaries(vocab.parents ?? [], summaryById),
                sentences,
                // English's props stay as they were: only a page in another language carries its text.
                ...(localized && translations ? { text: localized.word, translations: sentenceTranslationsOf(sentences, translations, localized.text.language) } : {}),
            },
            document: documentOf(urls.vocabPath(id), vocabMeta, {
                style: 'vocab',
                structuredData: { '@context': 'https://schema.org', '@type': 'DefinedTerm', name: headwordOf(vocab), description: vocabMeta.description },
            }),
        };
    }

    const englishOnly = pagesInEnglishOnly(locale);

    async function kanjiPage(character: string): Promise<Rendered<KanjiPageProps>> {
        const [byCharacter, kanjiVocab, summaryById, orders] = await Promise.all([kanjiByCharacter(), kanjiVocabIndex(), summaries(), kanjiOrderLists()]);
        const kanji = byCharacter.get(character);
        if (kanji === undefined) throw new PageNotFound(`no kanji ${character}`);
        // Every word, most frequent first (the index's order); the page collapses all but the first.
        const words = resolveSummaries(kanjiVocab[kanji.character] ?? [], summaryById);
        return {
            props: {
                kanji,
                words,
                kanjiWithPages: new Set(byCharacter.keys()),
                // A kanji page links each book position to its range page, which needs the order's length.
                orderLengths: new Map(orders.map(({ order, list: orderList }) => [order.id, orderList.length])),
            },
            document: documentOf(urls.kanjiPath(kanji.character), meta.kanji(kanji, words.length), { style: 'kanji' }),
        };
    }

    async function grammarPage(id: string): Promise<Rendered<GrammarPageProps>> {
        const summaryById = await grammarSummaries();
        if (!summaryById.has(id)) throw new PageNotFound(`no grammar point ${id}`);
        const [point, { chapterLocatorIndex, variantGroups, conjugationIndex }, minedExamples] = await Promise.all([
            source.grammarPoint(id), grammarIndexes(), source.grammarMinedExamples(id),
        ]);
        const minedExamplesPool = minedExamples ?? [];
        return {
            props: {
                point,
                related: (point.family?.relatedPoints ?? [])
                    .map(relatedId => summaryById.get(relatedId))
                    .filter((other): other is GrammarSummary => other !== undefined),
                chapterLocator: chapterLocatorIndex.get(id) ?? null,
                variants: buildVariantSiblings(point, variantGroups, summaryById),
                conjugation: conjugationIndex[id] ?? null,
                minedExamples: minedExamplesPool.slice(0, MAX_MINED_EXAMPLES),
                minedExamplesTotalCount: minedExamplesPool.length,
            },
            document: documentOf(urls.grammarPath(id), meta.grammar(point), {
                style: 'grammar',
                structuredData: {
                    '@context': 'https://schema.org',
                    '@type': 'DefinedTerm',
                    name: point.title,
                    description: point.shortExplanation,
                    inDefinedTermSet: 'Japanese grammar',
                },
            }),
        };
    }

    return { vocabPage, kanjiPage: englishOnly(kanjiPage), grammarPage: englishOnly(grammarPage) };
}

/** Every page the site has in one locale, over one source of the whole dataset (read in its language). */
export type Pages = ReturnType<typeof pagesOf>;

export function pagesOf(source: DictionaryData, locale: ServedLocale) {
    const { urls, meta, documentOf } = writtenIn(locale);
    const text = localeTextOf(source, locale);
    const englishOnly = pagesInEnglishOnly(locale);

    // -------------------------------------------------------------------------- shared indexes

    const indexes = entityIndexesOf(source);
    const { summaries, kanjiList, kanjiOrderLists, grammarIndexes } = indexes;
    const vocabIds = kept(async () => source.vocabIds());
    const knownVocabIds = kept(async (): Promise<ReadonlySet<string>> => new Set(await vocabIds()));
    const frequencyIndex = kept(async () => source.frequencyIndex());
    const contrasts = kept(async () => source.grammarContrasts());

    /** Every point by id, loaded in full (766 small files): the list pages show what each says. */
    const grammarPoints = kept(async () => {
        const points = new Map<string, GrammarPoint>();
        for (const id of await source.grammarIds()) points.set(id, await source.grammarPoint(id));
        return points;
    });

    /** Every point grouped by level, in the order the curriculum teaches it. */
    const pointsInOrder = kept(async () => inTeachingOrder([...(await grammarPoints()).values()], (await grammarIndexes()).teachingOrder.order));
    const familyPages = kept(async () => buildFamilyPages([...(await grammarPoints()).values()], await contrasts()));
    const chapterRows = kept(async () => buildChapterIndexRows((await grammarIndexes()).teachingOrder, await grammarPoints()));

    /** Each JLPT level's words, frequency-ordered; a level with none is left out. */
    const jlptLevelWords = kept(async () => {
        const [index, summaryById] = await Promise.all([source.vocabJlptIndex(), summaries()]);
        return JLPT_LEVELS.map(level => ({
            level,
            // The index carries only {id, containedKanji}; an id with no summary is dropped rather than rendered blank.
            words: resolveSummaries((index[level] ?? []).map(entry => entry.id), summaryById),
        })).filter(group => group.words.length > 0);
    });

    /** One order's ranges of steps, by kanjiStepIndex: the rule the app's kanji-driven order follows. */
    const orderRanges = kept(async () => {
        const frequency = await frequencyIndex();
        return new Map((await kanjiOrderLists()).map(({ order, list }) => [order.id, { order, list, ranges: kanjiRanges(list, kanjiStepIndex(frequency, list)) }]));
    });

    /** Every example sentence across every word, for the home page's count. */
    const sentenceCount = kept(async () => {
        let count = 0;
        for (const id of await vocabIds()) count += (await source.sentencesFor(id))?.length ?? 0;
        return count;
    });

    function orderBySlug(slug: string): KanjiOrder {
        const order = KANJI_ORDERS.find(candidate => kanjiOrderSlug(candidate.id) === slug);
        if (order === undefined) throw new PageNotFound(`no kanji order ${slug}`);
        return order;
    }

    async function rangesOf(orderId: KanjiOrderId): Promise<{ order: KanjiOrder; list: KanjiOrderList; ranges: KanjiRange[] }> {
        const found = (await orderRanges()).get(orderId);
        if (found === undefined) throw new PageNotFound(`no kanji order ${orderId}`);
        return found;
    }

    const wordCountOf = (ranges: readonly KanjiRange[]) => ranges.reduce((sum, range) => sum + range.wordCount, 0);

    // -------------------------------------------------------------------------- grammar lists

    async function grammarIndexPage(): Promise<Rendered<GrammarIndexPageProps>> {
        const points = await grammarPoints();
        // The filter (client/grammarFilter.ts) works over these rows.
        return {
            props: { groups: groupByLevel((await pointsInOrder()).map(grammarSummaryOf)), total: points.size },
            document: documentOf(urls.grammarIndexPath(), meta.grammarIndex(points.size), { style: 'grammarIndex', script: 'grammarFilter' }),
        };
    }

    async function grammarFamiliesIndexPage(): Promise<Rendered<GrammarFamiliesIndexPageProps>> {
        const families = await familyPages();
        return { props: { families }, document: documentOf(urls.grammarFamiliesIndexPath(), meta.grammarFamiliesIndex(families.length), { style: 'grammarFamily' }) };
    }

    /** One near-synonym family, comparing its members: an "X vs Y grammar" page no single point's can be. */
    async function grammarFamilyPage(id: string): Promise<Rendered<GrammarFamilyPageProps>> {
        const family = (await familyPages()).find(candidate => candidate.id === id);
        if (family === undefined) throw new PageNotFound(`no grammar family ${id}`);
        return { props: { family }, document: documentOf(urls.grammarFamilyPath(family.id), meta.grammarFamily(family.name, family.members.length), { style: 'grammarFamily' }) };
    }

    async function grammarChaptersIndexPage(): Promise<Rendered<GrammarChaptersIndexPageProps>> {
        const rows = await chapterRows();
        const { teachingOrder } = await grammarIndexes();
        return {
            props: { groups: groupByLevel(rows), chapterCount: rows.length },
            document: documentOf(urls.grammarChaptersIndexPath(), meta.grammarChaptersIndex(rows.length, teachingOrder.order.length), { style: 'grammarChapters' }),
        };
    }

    /** The authored teaching order as a browsable curriculum: "what order will I meet these in". */
    async function grammarChapterPage(id: string): Promise<Rendered<GrammarChapterPageProps>> {
        const rows = await chapterRows();
        const index = rows.findIndex(row => row.id === id);
        if (index < 0) throw new PageNotFound(`no grammar chapter ${id}`);
        const { teachingOrder } = await grammarIndexes();
        const previous = rows[index - 1] ?? null;
        const next = rows[index + 1] ?? null;
        return {
            props: {
                chapter: rows[index],
                totalChapters: rows.length,
                previous: previous ? { id: previous.id, title: previous.title } : null,
                next: next ? { id: next.id, title: next.title } : null,
            },
            document: documentOf(urls.grammarChapterPath(id), meta.grammarChapter(teachingOrder.chapters[index]), { style: 'grammarChapters' }),
        };
    }

    /** The inflection points as one table per word type: a landing page for "Japanese potential form". */
    async function grammarConjugationsIndexPage(): Promise<Rendered<GrammarConjugationsIndexPageProps>> {
        const { conjugationIndex } = await grammarIndexes();
        const formCount = Object.keys(conjugationIndex).length;
        return {
            props: { tables: conjugationTables(conjugationIndex, await grammarPoints()), formCount },
            document: documentOf(
                urls.grammarConjugationsIndexPath(),
                meta.grammarConjugationsIndex(new Set(Object.values(conjugationIndex).map(entry => entry.form)).size, formCount),
                { style: 'grammarConjugations' },
            ),
        };
    }

    // -------------------------------------------------------------------------- kanji lists

    async function kanjiIndexPage(): Promise<Rendered<KanjiIndexPageProps>> {
        const list = await kanjiList();
        const groups: { level: number | null; kanji: Kanji[] }[] = [
            ...JLPT_LEVELS.map(level => ({ level, kanji: list.filter(kanji => kanji.steps.jlpt === level) })),
            { level: null, kanji: list.filter(kanji => kanji.steps.jlpt === undefined) },
        ].filter(group => group.kanji.length > 0);
        return { props: { groups }, document: documentOf(urls.kanjiIndexPath(), meta.kanjiIndex(list.length), { style: 'kanjiIndex' }) };
    }

    async function kanjiOrdersPage(): Promise<Rendered<KanjiOrdersPageProps>> {
        const orders = [...(await orderRanges()).values()].map(({ order, list, ranges }) => ({ order, kanjiCount: list.length, wordCount: wordCountOf(ranges) }));
        return { props: { orders }, document: documentOf(urls.kanjiOrdersPath(), meta.kanjiOrders(KANJI_ORDERS)) };
    }

    /** One learning order: the words each step unlocks, in ranges of steps. */
    async function kanjiOrderPage(slug: string): Promise<Rendered<KanjiOrderPageProps>> {
        const { order, list, ranges } = await rangesOf(orderBySlug(slug).id);
        const wordCount = wordCountOf(ranges);
        return {
            props: { order, ranges, kanjiCount: list.length, wordCount },
            document: documentOf(urls.kanjiOrderPath(order.id), meta.kanjiOrder(order, list.length, wordCount), { style: 'kanjiOrders' }),
        };
    }

    async function kanjiRangePage(slug: string, rangeSlug: string): Promise<Rendered<KanjiRangePageProps>> {
        const { order, ranges } = await rangesOf(orderBySlug(slug).id);
        const range = ranges.find(candidate => kanjiRangeSlug(candidate) === rangeSlug);
        if (range === undefined) throw new PageNotFound(`no range ${rangeSlug} in ${slug}`);
        const summaryById = await summaries();
        return {
            props: {
                order,
                range: { first: range.first, last: range.last },
                steps: range.steps.map(({ step, character, wordIds }) => ({
                    step,
                    character,
                    words: resolveSummaries(wordIds.slice(0, WORDS_PER_KANJI), summaryById),
                    total: wordIds.length,
                })),
                wordCount: range.wordCount,
                ranges: ranges.map(({ first, last }) => ({ first, last })),
            },
            document: documentOf(urls.kanjiRangePath(order.id, range), meta.kanjiRange(order, range, range.wordCount), { style: 'kanjiOrders' }),
        };
    }

    // -------------------------------------------------------------------------- vocabulary lists, home, search

    /** One page of a JLPT level's words: split so no list is too heavy for a phone (N1 is ~2,800 words). */
    async function vocabJlptPage(level: number, page: number): Promise<Rendered<VocabJlptPageProps>> {
        const levels = await jlptLevelWords();
        const words = levels.find(group => group.level === level)?.words;
        const pages = words ? paginate(words, JLPT_PAGE_SIZE) : [];
        const pageWords = pages[page - 1] as VocabSummary[] | undefined;
        if (words === undefined || pageWords === undefined) throw new PageNotFound(`no page ${page} of N${level}`);
        return {
            props: {
                level,
                words: pageWords,
                total: words.length,
                page,
                pageCount: pages.length,
                firstRank: (page - 1) * JLPT_PAGE_SIZE + 1,
                allLevels: levels.map(group => group.level),
            },
            document: documentOf(urls.vocabJlptPath(level, page), meta.vocabJlpt(level, words.length, page)),
        };
    }

    async function vocabIndexPage(): Promise<Rendered<VocabIndexPageProps>> {
        const totalCount = (await vocabIds()).length;
        return {
            props: { levels: (await jlptLevelWords()).map(({ level, words }) => ({ level, count: words.length })), totalCount },
            document: documentOf(urls.vocabIndexPath(), meta.vocabIndex(totalCount)),
        };
    }

    /** No props: the results are found in the browser (client/search.ts). */
    function searchPage(): Rendered<Record<string, never>> {
        return { props: {}, document: documentOf(urls.searchPath(), meta.search(), { noindex: true }) };
    }

    async function homePage(): Promise<Rendered<HomePageProps>> {
        const levels = await jlptLevelWords();
        return {
            props: {
                vocabCount: (await vocabIds()).length,
                kanjiCount: (await kanjiList()).length,
                grammarCount: (await grammarPoints()).size,
                sentenceCount: await sentenceCount(),
                // The most frequent N5 words: the index is frequency-ordered, so the head of the
                // easiest level is the closest thing the dataset has to "words a visitor will know".
                featured: (levels.find(group => group.level === 5)?.words ?? []).slice(0, FEATURED_WORDS),
            },
            document: documentOf(urls.homePath(), meta.home(), { style: 'home' }),
        };
    }

    /** The search index's two files: every word in frequency order (a row's position is its rank), every kanji and point. */
    const searchIndex = kept(async (): Promise<{ core: SearchIndexFile; full: SearchIndexFile }> => {
        const known = await knownVocabIds();
        const wordRows: SearchWordRow[] = [];
        for (const { id } of await frequencyIndex()) {
            if (known.has(id)) wordRows.push(searchWordRow(await source.vocab(id)));
        }
        return splitSearchIndex(wordRows, (await kanjiList()).map(searchKanjiRow), (await pointsInOrder()).map(searchGrammarRow));
    });

    // -------------------------------------------------------------------------- the catalog

    /** Every value of each route's parameters: the prerender entries. */
    const everyPageEntries = {
        vocab: async () => (await vocabIds()).map(id => ({ id })),
        kanji: async () => (await kanjiList()).map(kanji => ({ character: kanji.character })),
        grammar: async () => [...(await grammarPoints()).keys()].map(id => ({ id })),
        grammarFamily: async () => (await familyPages()).map(family => ({ id: family.id })),
        grammarChapter: async () => (await chapterRows()).map(chapter => ({ id: chapter.id })),
        kanjiOrder: async () => [...(await orderRanges()).keys()].map(id => ({ order: kanjiOrderSlug(id) })),
        kanjiRange: async () => [...(await orderRanges()).values()].flatMap(({ order, ranges }) => ranges.map(range => ({ order: kanjiOrderSlug(order.id), range: kanjiRangeSlug(range) }))),
        vocabJlpt: async () => (await jlptLevelWords()).map(({ level }) => ({ level: String(level) })),
        vocabJlptPage: async () => (await jlptLevelWords()).flatMap(({ level, words }) => paginate(words, JLPT_PAGE_SIZE).slice(1).map((_, index) => ({ level: String(level), page: String(index + 2) }))),
    };
    /** Another locale's: its words with text shown in its language (LocaleText.wordIds), and nothing else yet. */
    const wordsWithText = kept(async () => (text ? text.wordIds() : vocabIds()));
    const none = () => Promise.resolve([]);
    const pageEntries: typeof everyPageEntries = text === null ? everyPageEntries : {
        vocab: async () => (await wordsWithText()).map(id => ({ id })),
        kanji: none, grammar: none, grammarFamily: none, grammarChapter: none, kanjiOrder: none, kanjiRange: none, vocabJlpt: none, vocabJlptPage: none,
    };

    /**
     * Every indexed page's path, for the sitemap: the home page first, then each page type in the
     * order the static generator wrote them, kept so a sitemap does not reorder (and re-upload) for
     * a framework change. The search page is noindex, so absent.
     */
    async function sitemapPaths(): Promise<string[]> {
        if (text !== null) return (await wordsWithText()).map(id => urls.vocabPath(id));
        const [ids, list, points, families, chapters, orders, levels] = await Promise.all([
            vocabIds(), kanjiList(), grammarPoints(), familyPages(), chapterRows(), orderRanges(), jlptLevelWords(),
        ]);
        return [
            urls.homePath(),
            ...ids.map(id => urls.vocabPath(id)),
            ...list.map(kanji => urls.kanjiPath(kanji.character)),
            ...[...points.keys()].map(id => urls.grammarPath(id)),
            urls.grammarIndexPath(),
            urls.grammarFamiliesIndexPath(),
            ...families.map(family => urls.grammarFamilyPath(family.id)),
            urls.grammarChaptersIndexPath(),
            ...chapters.map(chapter => urls.grammarChapterPath(chapter.id)),
            urls.grammarConjugationsIndexPath(),
            urls.kanjiIndexPath(),
            ...[...orders.values()].flatMap(({ order, ranges }) => [urls.kanjiOrderPath(order.id), ...ranges.map(range => urls.kanjiRangePath(order.id, range))]),
            urls.kanjiOrdersPath(),
            ...levels.flatMap(({ level, words }) => paginate(words, JLPT_PAGE_SIZE).map((_, index) => urls.vocabJlptPath(level, index + 1))),
            urls.vocabIndexPath(),
        ];
    }

    return {
        ...entityPagesOf(source, locale, indexes),
        grammarIndexPage: englishOnly(grammarIndexPage),
        grammarFamiliesIndexPage: englishOnly(grammarFamiliesIndexPage),
        grammarFamilyPage: englishOnly(grammarFamilyPage),
        grammarChaptersIndexPage: englishOnly(grammarChaptersIndexPage),
        grammarChapterPage: englishOnly(grammarChapterPage),
        grammarConjugationsIndexPage: englishOnly(grammarConjugationsIndexPage),
        kanjiIndexPage: englishOnly(kanjiIndexPage),
        kanjiOrdersPage: englishOnly(kanjiOrdersPage),
        kanjiOrderPage: englishOnly(kanjiOrderPage),
        kanjiRangePage: englishOnly(kanjiRangePage),
        vocabJlptPage: englishOnly(vocabJlptPage),
        vocabIndexPage: englishOnly(vocabIndexPage),
        searchPage: englishOnly(searchPage),
        homePage: englishOnly(homePage),
        searchIndex,
        pageEntries,
        sitemapPaths,
    };
}
