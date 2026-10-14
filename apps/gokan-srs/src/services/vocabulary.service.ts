import type {
    FrequencyIndex, JlptIndex, KKLCIndex, Kanji, KanjiOrderId, KanjiOrderList, KanjiVocabIndex, SearchIndex, Sentence, Vocabulary,
} from '@gokan/dataset-schema';
import { romajiToHiragana, looksLikeRomaji } from '@gokan/dataset-schema';
import { kanjiStepIndex, type KanjiStepIndex } from '../utils/kanjiOrder.utils';
import { datasetUrl, fetchJson, readJson, RequestCache, sharedRequest } from './http';

/**
 * Whether the server says this dataset file does not exist, as opposed to a transient failure.
 * A dev server returns 404; production CloudFront's distribution-wide SPA fallback rewrites a
 * missing key to index.html at 200 (text/html). A 5xx, 403 or 429 is not absence.
 */
function isMissingFile(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    return response.status === 404 || (response.ok && contentType.includes('text/html'));
}

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
    const path = datasetUrl(`vocab/${id}.json`);
    const response = await fetch(path);

    // Retire ONLY on a definitive "the server does not have this file", never
    // on a transient failure - retirement is a permanent tombstone, so it must
    // not fire during a deploy or a CloudFront/S3 hiccup. The two definitive
    // signals are a real 404 (dev server, or a true origin 404) and the prod
    // SPA fallback (CloudFront's distribution-wide custom_error_response
    // rewrites a missing key to index.html at 200/text/html). Everything else -
    // a 5xx, 403, 429, an offline fetch rejection (never reaches here), or a
    // 200 whose body is unparseable - is treated as a normal (recoverable,
    // fatal) error below, so a legitimate word is never retired by a blip.
    if (isMissingFile(response)) {
        throw new VocabNotFoundError(id);
    }
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return readJson<Vocabulary>(response);
}

/** A kanji's own file, or null (cached like a kanji) when the dataset has no such kanji. */
async function fetchKanji(character: string): Promise<Kanji | null> {
    const path = datasetUrl(`kanji/${encodeURIComponent(character)}.json`);
    const response = await fetch(path);
    if (isMissingFile(response)) return null;
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return readJson<Kanji>(response);
}

export class VocabularyService {
    private static kklcIndex = sharedRequest(() => fetchJson<KKLCIndex>(datasetUrl('index/kklc.json')));
    private static frequencyIndex = sharedRequest(() => fetchJson<FrequencyIndex>(datasetUrl('index/frequency.json')));
    private static usuallyKanaIds: ReadonlySet<string> | null = null;
    private static searchIndex = sharedRequest(() => fetchJson<SearchIndex>(datasetUrl('index/search.json')));
    private static vocabs = new RequestCache(fetchVocab);
    private static kanji = new RequestCache(fetchKanji);
    private static kanjiVocabIndex = sharedRequest(() => fetchJson<KanjiVocabIndex>(datasetUrl('index/kanji-vocab.json')));
    private static jlptIndex = sharedRequest(() => fetchJson<JlptIndex>(datasetUrl('index/jlpt.json')));
    private static kanjiOrders = new RequestCache(order => fetchJson<KanjiOrderList>(datasetUrl(`index/kanji-orders/${order}.json`)));
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
        if (!index) return [];

        const q = query.toLowerCase().trim();
        if (!q) return [];

        // Also try a romaji->hiragana conversion so "nichi" matches the reading にち.
        // Only when the query actually contains latin letters, and only if the
        // conversion changed something (otherwise it's identical to the raw match).
        const kanaQuery = looksLikeRomaji(q) ? romajiToHiragana(q) : null;

        return index.filter(entry =>
            entry.w.includes(q) ||
            entry.r.toLowerCase().includes(q) ||
            entry.m.toLowerCase().includes(q) ||
            (kanaQuery !== null && kanaQuery !== q && entry.r.includes(kanaQuery))
        ).slice(0, 50);
    }

    /** One kanji from its own file (about 1 KB, where kanji.json is every kanji); null when the dataset has no such kanji. */
    static loadKanji(character: string): Promise<Kanji | null> {
        return this.kanji.get(character);
    }

    static loadKanjiVocabIndex(): Promise<KanjiVocabIndex> {
        return this.kanjiVocabIndex.get();
    }

    /** The word's example sentences (the file is a plain Sentence array), or null when it has none. */
    static async loadSentences(vocabId: string): Promise<Sentence[] | null> {
        try {
            return await fetchJson<Sentence[]>(datasetUrl(`sentences/${vocabId}.json`));
        } catch {
            // No sentences found for this vocab is a valid state
            return null;
        }
    }
}
