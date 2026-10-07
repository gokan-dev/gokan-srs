import type { FrequencyIndex, JlptIndex, KKLCIndex, KKLCKanjiIndex, Kanji, KanjiVocabIndex, SearchIndex, Sentence, Vocabulary } from '@gokan/dataset-schema';
import { romajiToHiragana, looksLikeRomaji } from '../utils/romaji';
import { datasetUrl, fetchJson, readJson } from './http';

/**
 * A vocab's compiled file genuinely does not exist (it was dropped from the
 * dataset), as opposed to a transient network failure. Thrown by loadVocab so a
 * caller can RETIRE the id rather than fatal-erroring - see RETIRE_VOCAB.
 *
 * Absence looks different per environment: a dev server returns 404, while
 * production CloudFront's distribution-wide SPA fallback rewrites a missing file
 * to index.html at 200 (text/html). Both are detected here. A thrown fetch
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

export class VocabularyService {
    private static kklcIndex: KKLCIndex | null = null;
    private static kklcKanjiIndex: KKLCKanjiIndex | null = null;
    private static frequencyIndex: FrequencyIndex | null = null;
    private static usuallyKanaIds: ReadonlySet<string> | null = null;
    private static searchIndex: SearchIndex | null = null;
    private static vocabCache = new Map<string, Vocabulary>();
    private static kanjiIndex: Kanji[] | null = null;
    private static kanjiByChar = new Map<string, Kanji>();
    private static kanjiVocabIndex: KanjiVocabIndex | null = null;
    private static jlptIndex: JlptIndex | null = null;

    static async loadKKLCKanjiIndex(): Promise<KKLCKanjiIndex | null> {
        if (this.kklcKanjiIndex) return this.kklcKanjiIndex;

        this.kklcKanjiIndex = await fetchJson<KKLCKanjiIndex>(datasetUrl('index/kklc-kanji.json'));
        return this.kklcKanjiIndex;
    }

    static async loadKKLCIndex(): Promise<KKLCIndex | null> {
        if (this.kklcIndex) return this.kklcIndex;

        this.kklcIndex = await fetchJson<KKLCIndex>(datasetUrl('index/kklc.json'));
        return this.kklcIndex;
    }

    static async loadFrequencyIndex(): Promise<FrequencyIndex | null> {
        if (this.frequencyIndex) return this.frequencyIndex;

        this.frequencyIndex = await fetchJson<FrequencyIndex>(datasetUrl('index/frequency.json'));
        return this.frequencyIndex;
    }

    /** Ids of the words learned in kana (VocabIndexEntry.usuallyKana), read off the frequency index. */
    static async loadUsuallyKanaIds(): Promise<ReadonlySet<string>> {
        if (this.usuallyKanaIds) return this.usuallyKanaIds;
        const index = await this.loadFrequencyIndex();
        this.usuallyKanaIds = new Set((index ?? []).filter(entry => entry.usuallyKana).map(entry => entry.id));
        return this.usuallyKanaIds;
    }

    static async loadJlptIndex(): Promise<JlptIndex | null> {
        if (this.jlptIndex) return this.jlptIndex;

        this.jlptIndex = await fetchJson<JlptIndex>(datasetUrl('index/jlpt.json'));
        return this.jlptIndex;
    }

    static async loadVocab(id: string): Promise<Vocabulary> {
        if (this.vocabCache.has(id)) {
            return this.vocabCache.get(id)!;
        }

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
        const contentType = response.headers.get('content-type') || '';
        const notFound = response.status === 404 || (response.ok && contentType.includes('text/html'));
        if (notFound) {
            throw new VocabNotFoundError(id);
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
        }
        const vocab = await readJson<Vocabulary>(response);
        this.vocabCache.set(id, vocab);
        return vocab;
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
        if (this.searchIndex) return this.searchIndex;

        try {
            this.searchIndex = await fetchJson<SearchIndex>(datasetUrl('index/search.json'));
            return this.searchIndex;
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

    static async loadKanjiIndex(): Promise<Kanji[]> {
        if (this.kanjiIndex) return this.kanjiIndex;

        this.kanjiIndex = await fetchJson<Kanji[]>(datasetUrl('kanji.json'));
        for (const k of this.kanjiIndex) this.kanjiByChar.set(k.character, k);
        return this.kanjiIndex;
    }

    static async loadKanji(character: string): Promise<Kanji | null> {
        await this.loadKanjiIndex();
        return this.kanjiByChar.get(character) ?? null;
    }

    static async loadKanjiVocabIndex(): Promise<KanjiVocabIndex> {
        if (this.kanjiVocabIndex) return this.kanjiVocabIndex;

        this.kanjiVocabIndex = await fetchJson<KanjiVocabIndex>(datasetUrl('index/kanji-vocab.json'));
        return this.kanjiVocabIndex;
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
