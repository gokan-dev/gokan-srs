import type { Vocabulary } from '../models/vocabulary.model';
import type { Kanji } from '../models/kanji.model';
import type { FrequencyIndex, JlptIndex, KKLCIndex, KKLCKanjiIndex, KanjiVocabIndex, SearchIndex } from '../models/index.model';
import { romajiToHiragana, looksLikeRomaji } from '../utils/romaji';
import { fetchJson, readJson } from './http';
import type { Sentence } from '../models/sentence.model';

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
    private static searchIndex: SearchIndex | null = null;
    private static vocabCache = new Map<string, Vocabulary>();
    private static kanjiIndex: Kanji[] | null = null;
    private static kanjiByChar = new Map<string, Kanji>();
    private static kanjiVocabIndex: KanjiVocabIndex | null = null;
    private static jlptIndex: JlptIndex | null = null;

    static async loadKKLCKanjiIndex(): Promise<KKLCKanjiIndex | null> {
        if (this.kklcKanjiIndex) return this.kklcKanjiIndex;

        this.kklcKanjiIndex = await fetchJson<KKLCKanjiIndex>(`/data/compiled/index/kklc-kanji.json?v=${Date.now()}`);
        return this.kklcKanjiIndex;
    }

    static async loadKKLCIndex(): Promise<KKLCIndex | null> {
        if (this.kklcIndex) return this.kklcIndex;

        this.kklcIndex = await fetchJson<KKLCIndex>(`/data/compiled/index/kklc.json?v=${Date.now()}`);
        return this.kklcIndex;
    }

    static async loadFrequencyIndex(): Promise<FrequencyIndex | null> {
        if (this.frequencyIndex) return this.frequencyIndex;

        this.frequencyIndex = await fetchJson<FrequencyIndex>(`/data/compiled/index/frequency.json?v=${Date.now()}`);
        return this.frequencyIndex;
    }

    static async loadJlptIndex(): Promise<JlptIndex | null> {
        if (this.jlptIndex) return this.jlptIndex;

        this.jlptIndex = await fetchJson<JlptIndex>(`/data/compiled/index/jlpt.json?v=${Date.now()}`);
        return this.jlptIndex;
    }

    static async loadVocab(id: string): Promise<Vocabulary> {
        if (this.vocabCache.has(id)) {
            return this.vocabCache.get(id)!;
        }

        const path = `/data/compiled/vocab/${id}.json`;
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

    static async loadSearchIndex(): Promise<SearchIndex | null> {
        if (this.searchIndex) return this.searchIndex;

        try {
            this.searchIndex = await fetchJson<SearchIndex>(`/data/compiled/index/search.json?v=${Date.now()}`);
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

        this.kanjiIndex = await fetchJson<Kanji[]>(`/data/compiled/kanji.json?v=${Date.now()}`);
        for (const k of this.kanjiIndex) this.kanjiByChar.set(k.character, k);
        return this.kanjiIndex;
    }

    static async loadKanji(character: string): Promise<Kanji | null> {
        await this.loadKanjiIndex();
        return this.kanjiByChar.get(character) ?? null;
    }

    static async loadKanjiVocabIndex(): Promise<KanjiVocabIndex> {
        if (this.kanjiVocabIndex) return this.kanjiVocabIndex;

        this.kanjiVocabIndex = await fetchJson<KanjiVocabIndex>(`/data/compiled/index/kanji-vocab.json?v=${Date.now()}`);
        return this.kanjiVocabIndex;
    }

    /** The word's example sentences (the file is a plain Sentence array), or null when it has none. */
    static async loadSentences(vocabId: string): Promise<Sentence[] | null> {
        try {
            return await fetchJson<Sentence[]>(`/data/compiled/sentences/${vocabId}.json`);
        } catch {
            // No sentences found for this vocab is a valid state
            return null;
        }
    }
}
