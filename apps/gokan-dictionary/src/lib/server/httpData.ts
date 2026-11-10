// What a page rendered on request reads (EntityData), from the published dataset over HTTP: the
// same files gokan-srs reads, under /dataset/, each in its English shape through the reader both
// apps share (publishedDatasetReader), another language's text files beside them (localeText),
// and the summaries of every word and grammar point from the search index the build writes beside
// the pages. No database: CloudFront caches the files for
// every renderer, as it does for every browser. Each index is fetched once per process and kept;
// an entity's own files on each page.

import { isMissingFile, publishedDatasetReader } from '@gokan/dataset-schema/published-dataset';
import type {
    GrammarConjugationIndex, GrammarExample, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex, Kanji, KanjiOrderList, KanjiVocabIndex, Sentence,
    Vocabulary,
} from '@gokan/dataset-schema';
import { DATASET_PATHS } from '../datasetPaths';
import type { DatasetLanguage } from '../locale';
import { grammarSummaryOfRow } from '../grammarBrowse';
import { fromColumns } from '../searchIndex';
import type { EntityData, GrammarSummary, SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordColumns, VocabSummary } from '../types';
import { vocabSummaryOfRow } from '../vocabSummary';
import { kept } from './kept';
import { localeText } from './localeText';

export interface HttpDataOptions {
    /** A dataset file's URL: the origin, /dataset/, the path, and the dataset version. */
    datasetUrl: (path: string) => string;
    /** The search index's two files (searchIndexPaths), as absolute URLs. */
    searchIndexUrls: { core: string; full: string };
    /** The dataset version this server was built for: the search index must carry it (stampedSearchIndex). */
    datasetVersion: string;
    /** The language of the dataset's text the files are read in. */
    language: DatasetLanguage;
    fetch?: (url: string) => Promise<Response>;
}

const isArrayOf = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number';
const isTuple = <T extends unknown[]>(...items: ((entry: unknown) => boolean)[]) => (value: unknown): value is T =>
    Array.isArray(value) && value.length === items.length && items.every((item, i) => item(value[i]));
const isWordColumns = (value: unknown): value is SearchWordColumns => {
    if (!Array.isArray(value) || value.length !== 6) return false;
    const columns: unknown[] = value;
    const [ids] = columns;
    if (!isArrayOf(ids, isString)) return false;
    return columns.every((column, i) => (i < 4 ? isArrayOf(column, isString) : isArrayOf(column, isNumber)) && Array.isArray(column) && column.length === ids.length);
};
const isKanjiRow = isTuple<SearchKanjiRow>(isString, isNumber, isNumber);
const isGrammarRow = isTuple<SearchGrammarRow>(isString, isString, isString, isString, isNumber);

/**
 * A search index file as fetched, checked once here: these rows decide which words exist (a 404)
 * and what a page lists, so an index of another dataset version (a deploy half done) or of
 * another shape fails the page, a 5xx never cached, rather than render it with entries missing.
 */
export function parseSearchIndexFile(body: unknown, url: string, datasetVersion: string): SearchIndexFile {
    if (typeof body !== 'object' || body === null) throw new Error(`${url} is not a search index file.`);
    const { w, k, g, datasetVersion: version }: Record<string, unknown> = { ...body };
    if (version !== datasetVersion) throw new Error(`${url} is of dataset ${String(version)}, this server of ${datasetVersion}.`);
    if (!isWordColumns(w)) throw new Error(`${url}: its words (w) are not six equal columns.`);
    if (k !== undefined && !isArrayOf(k, isKanjiRow)) throw new Error(`${url}: its kanji rows (k) are malformed.`);
    if (g !== undefined && !isArrayOf(g, isGrammarRow)) throw new Error(`${url}: its grammar rows (g) are malformed.`);
    return { w, ...(k ? { k } : {}), ...(g ? { g } : {}), datasetVersion };
}

export function httpData({ datasetUrl, searchIndexUrls, datasetVersion, language, fetch: fetchFile = url => fetch(url) }: HttpDataOptions): EntityData {
    // Every file in its English shape (a page's core facts), and another language's text files as published.
    const dataset = publishedDatasetReader({ url: datasetUrl, fetch: fetchFile });
    const file = <T>(path: string) => dataset.file<T>(path);

    /** One of the site's own files: the search index. Its absence is an error, never "no words". */
    const searchIndexFile = async (url: string): Promise<SearchIndexFile> => {
        const response = await fetchFile(url);
        if (!response.ok || isMissingFile(response)) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        const body: unknown = await response.json();
        return parseSearchIndexFile(body, url, datasetVersion);
    };
    const searchIndex = kept(async () => {
        const [core, full] = await Promise.all([searchIndexFile(searchIndexUrls.core), searchIndexFile(searchIndexUrls.full)]);
        return { core, full };
    });

    const kanjiList = kept(() => file<Kanji[]>(DATASET_PATHS.kanjiList));
    const kanjiVocabIndex = kept(() => file<KanjiVocabIndex>(DATASET_PATHS.kanjiVocabIndex));
    const teachingOrder = kept(() => file<GrammarTeachingOrder>(DATASET_PATHS.grammarTeachingOrder));
    const variantGroups = kept(() => file<GrammarVariantGroupIndex>(DATASET_PATHS.grammarVariantGroups));
    const conjugations = kept(() => file<GrammarConjugationIndex>(DATASET_PATHS.grammarConjugations));

    return {
        vocab: id => file<Vocabulary>(DATASET_PATHS.vocab(id)),
        sentencesFor: vocabId => dataset.optionalFile<Sentence[]>(DATASET_PATHS.sentences(vocabId)),
        wordSummaries: kept(async (): Promise<ReadonlyMap<string, VocabSummary>> => {
            const { core, full } = await searchIndex();
            return new Map([...fromColumns(core.w), ...fromColumns(full.w)].map(row => [row[0], vocabSummaryOfRow(row)]));
        }),
        grammarSummaries: kept(async (): Promise<ReadonlyMap<string, GrammarSummary>> =>
            new Map(((await searchIndex()).core.g ?? []).map(row => [row[0], grammarSummaryOfRow(row)]))),
        kanjiList,
        kanjiVocabIndex,
        kanjiOrder: order => file<KanjiOrderList>(DATASET_PATHS.kanjiOrder(order)),
        grammarPoint: id => file<GrammarPoint>(DATASET_PATHS.grammarPoint(id)),
        grammarTeachingOrder: teachingOrder,
        grammarVariantGroups: variantGroups,
        grammarConjugations: conjugations,
        grammarMinedExamples: id => dataset.optionalFile<GrammarExample[]>(DATASET_PATHS.grammarMinedExamples(id)),
        localeText: language === 'en' ? null : localeText(language, { index: path => dataset.publishedFile(path), file: path => dataset.publishedFile(path), glosses: path => dataset.publishedFile(path), vocab: id => file<Vocabulary>(DATASET_PATHS.vocab(id)) }),
    };
}
