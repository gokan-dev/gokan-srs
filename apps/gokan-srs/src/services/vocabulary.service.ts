import type {
    FrequencyIndex, JlptIndex, KKLCIndex, Kanji, KanjiOrderId, KanjiOrderList, KanjiStepIndex, KanjiVocabIndex, SearchIndex, Sentence, Vocabulary,
} from '@gokan/dataset-schema';
import { kanjiStepIndex } from '@gokan/dataset-schema';
import { rankVocabSearch } from '../utils/vocabSearch.utils';
import { fetchDatasetFile, fetchOptionalDatasetFile, RequestCache, sharedRequest } from './http';

/**
 * A vocab's compiled file genuinely does not exist (it was dropped from the
 * dataset), as opposed to a transient network failure. Thrown by loadVocab so a
 * caller can RETIRE the id rather than fatal-erroring - see RETIRE_VOCAB.
 *
 * Absence looks different per environment: a dev server returns 404, while
 * production CloudFront's distribution-wide SPA fallback rewrites a missing file
 * to index.html at 200 (text/html). isMissingFile detects both. A thrown fetch
 * (offline / DNS) is NOT turned into this error, so a blip never deletes real
 * progress - it propagates and stays a genuine (fatal) failure.
 */
export class VocabNotFoundError extends Error {
    readonly vocabId: string;
    constructor(vocabId: string) {
        super(`Vocabulary ${vocabId} not found (retired or missing from the dataset)`);
        this.name = 'VocabNotFoundError';
        this.vocabId = vocabId;
    }
}

async function fetchVocab(id: string): Promise<Vocabulary> {
    // Retire ONLY on a definitive "the server does not have this file", never
    // on a transient failure - retirement is a permanent tombstone, so it must
    // not fire during a deploy or a CloudFront/S3 hiccup. The two definitive
    // signals are a real 404 (dev server, or a true origin 404) and the prod
    // SPA fallback (CloudFront's distribution-wide custom_error_response
    // rewrites a missing key to index.html at 200/text/html), both read by
    // isMissingFile. Everything else - a 5xx, 403, 429, an offline fetch
    // rejection, or a 200 whose body is unparseable - throws a normal
    // (recoverable, fatal) error, so a legitimate word is never retired by a blip.
    const vocab = await fetchOptionalDatasetFile<Vocabulary>(`vocab/${id}.json`);
    if (vocab === null) throw new VocabNotFoundError(id);
    return vocab;
}

/** A kanji's own file, or null (cached like a kanji) when the dataset has no such kanji. */
function fetchKanji(character: string): Promise<Kanji | null> {
    return fetchOptionalDatasetFile<Kanji>(`kanji/${encodeURIComponent(character)}.json`);
}

/** A word's sentence file, or null (cached) when the dataset has none for it; a transient failure throws, so it is not cached. */
function fetchSentences(vocabId: string): Promise<Sentence[] | null> {
    return fetchOptionalDatasetFile<Sentence[]>(`sentences/${vocabId}.json`);
}

export class VocabularyService {
    private static kklcIndex = sharedRequest(() => fetchDatasetFile<KKLCIndex>('index/kklc.json'));
    private static frequencyIndex = sharedRequest(() => fetchDatasetFile<FrequencyIndex>('index/frequency.json'));
    private static usuallyKanaIds: ReadonlySet<string> | null = null;
    private static searchIndex = sharedRequest(() => fetchDatasetFile<SearchIndex>('index/search.json'));
    private static vocabs = new RequestCache(fetchVocab);
    private static kanji = new RequestCache(fetchKanji);
    private static sentences = new RequestCache(fetchSentences);
    private static kanjiVocabIndex = sharedRequest(() => fetchDatasetFile<KanjiVocabIndex>('index/kanji-vocab.json'));
    private static jlptIndex = sharedRequest(() => fetchDatasetFile<JlptIndex>('index/jlpt.json'));
    private static kanjiOrders = new RequestCache(order => fetchDatasetFile<KanjiOrderList>(`index/kanji-orders/${order}.json`));
    private static kanjiStepIndexes = new Map<KanjiOrderId, KanjiStepIndex>();

    /** One kanji learning order's kanji, in teaching order. */
    static loadKanjiOrder(order: KanjiOrderId): Promise<KanjiOrderList> {
        return this.kanjiOrders.get(order);
    }

    /**
     * The words each step of a kanji order unlocks. KKLC reads the dataset's own index/kklc.json,
     * so a KKLC learner's word order is exactly what it has always been; every other order derives
     * it from the frequency index by the same rule (kanjiStepIndex).
     */
    static async loadKanjiStepIndex(order: KanjiOrderId): Promise<KanjiStepIndex | null> {
        if (order === 'kklc') return this.loadKKLCIndex();
        const cached = this.kanjiStepIndexes.get(order);
        if (cached) return cached;

        const [frequency, list] = await Promise.all([this.loadFrequencyIndex(), this.loadKanjiOrder(order)]);
        if (!frequency) return null;
        const index = kanjiStepIndex(frequency, list);
        this.kanjiStepIndexes.set(order, index);
        return index;
    }

    static loadKKLCIndex(): Promise<KKLCIndex | null> {
        return this.kklcIndex.get();
    }

    static loadFrequencyIndex(): Promise<FrequencyIndex | null> {
        return this.frequencyIndex.get();
    }

    /** Ids of the words learned in kana (VocabIndexEntry.usuallyKana), read off the frequency index. */
    static async loadUsuallyKanaIds(): Promise<ReadonlySet<string>> {
        if (this.usuallyKanaIds) return this.usuallyKanaIds;
        const index = await this.loadFrequencyIndex();
        this.usuallyKanaIds = new Set((index ?? []).filter(entry => entry.usuallyKana).map(entry => entry.id));
        return this.usuallyKanaIds;
    }

    static loadJlptIndex(): Promise<JlptIndex | null> {
        return this.jlptIndex.get();
    }

    static loadVocab(id: string): Promise<Vocabulary> {
        return this.vocabs.get(id);
    }

    /**
     * Several words at once, in the order asked, skipping any that fail to load (a
     * stale id in a related-words list must not take the whole list down). For a
     * quiz card, where a missing word is a data-integrity error, use loadVocab.
     */
    static async loadVocabs(ids: readonly string[]): Promise<Vocabulary[]> {
        const loaded = await Promise.all(ids.map(id => this.loadVocab(id).catch(() => null)));
        return loaded.filter((v): v is Vocabulary => v !== null);
    }

    static async loadSearchIndex(): Promise<SearchIndex | null> {
        try {
            return await this.searchIndex.get();
        } catch (e) {
            console.error("Failed to load search index", e);
            return null;
        }
    }

    static async searchVocab(query: string): Promise<SearchIndex> {
        const index = await this.loadSearchIndex();
        return index ? rankVocabSearch(index, query) : [];
    }

    /** One kanji from its own file (about 1 KB, where kanji.json is every kanji); null when the dataset has no such kanji. */
    static loadKanji(character: string): Promise<Kanji | null> {
        return this.kanji.get(character);
    }

    static loadKanjiVocabIndex(): Promise<KanjiVocabIndex> {
        return this.kanjiVocabIndex.get();
    }

    /**
     * The word's example sentences (the file is a plain Sentence array), or null when it has none.
     * The request is cached, so the session's prefetch of an upcoming intro and the card's own
     * load share one download. A failed load still reads as null (no sentences is a valid
     * state) but is not cached, so a later call retries it.
     */
    static async loadSentences(vocabId: string): Promise<Sentence[] | null> {
        try {
            return await this.sentences.get(vocabId);
        } catch {
            return null;
        }
    }
}
