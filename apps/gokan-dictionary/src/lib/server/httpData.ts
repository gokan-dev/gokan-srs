// What a page rendered on request reads (EntityData), from the published dataset over HTTP: the
// same files gokan-srs reads, under /dataset/, each in its English shape through the reader both
// apps share (publishedDatasetReader), and the summaries of every word and grammar point from the
// search index the build writes beside the pages. No database: CloudFront caches the files for
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
import type { EntityData, GrammarSummary, SearchIndexFile, VocabSummary } from '../types';
import { vocabSummaryOfRow } from '../vocabSummary';

export interface HttpDataOptions {
    /** A dataset file's URL: the origin, /dataset/, the path, and the dataset version. */
    datasetUrl: (path: string) => string;
    /** The search index's two files (searchIndexPaths), as absolute URLs. */
    searchIndexUrls: { core: string; full: string };
    /** The language of the dataset's text the files are read in. */
    language: DatasetLanguage;
    fetch?: (url: string) => Promise<Response>;
}

/** Each language's reader of the published dataset: English is the one the dataset projects today. */
const READERS: Record<DatasetLanguage, typeof publishedDatasetReader> = { en: publishedDatasetReader };

/** Built on first use, then kept; a load that fails is dropped, so the next page retries it. */
function kept<T>(load: () => Promise<T>): () => Promise<T> {
    let value: Promise<T> | null = null;
    return () => {
        if (value) return value;
        const request = load();
        value = request;
        request.catch(() => {
            if (value === request) value = null;
        });
        return request;
    };
}

export function httpData({ datasetUrl, searchIndexUrls, language, fetch: fetchFile = url => fetch(url) }: HttpDataOptions): EntityData {
    const dataset = READERS[language]({ url: datasetUrl, fetch: fetchFile });
    const file = <T>(path: string) => dataset.file<T>(path);

    /** One of the site's own files: the search index. Its absence is an error, never "no words". */
    const siteJson = async <T>(url: string): Promise<T> => {
        const response = await fetchFile(url);
        if (!response.ok || isMissingFile(response)) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        // The dictionary's own build wrote it (lib/searchIndex.ts), in the shape SearchIndexFile describes.
        const body: unknown = await response.json();
        return body as T;
    };
    const searchIndex = kept(async () => {
        const [core, full] = await Promise.all([siteJson<SearchIndexFile>(searchIndexUrls.core), siteJson<SearchIndexFile>(searchIndexUrls.full)]);
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
    };
}
