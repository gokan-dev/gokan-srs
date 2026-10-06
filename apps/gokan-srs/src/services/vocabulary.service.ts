// src/services/VocabularyLoader.ts
import type { Vocabulary } from '../models/vocabulary.model';
import type { Kanji } from '../models/kanji.model';
import type { FrequencyIndex, JlptIndex, KKLCIndex, KKLCKanjiIndex, KanjiVocabIndex, SearchIndex } from '../models/index.model';
import { romajiToHiragana, looksLikeRomaji } from '../utils/romaji';

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

    private static async fetchJson<T>(path: string): Promise<T> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
        }
        return response.json();
    }

    static async loadKKLCKanjiIndex(): Promise<KKLCKanjiIndex | null> {
        if (this.kklcKanjiIndex) return this.kklcKanjiIndex;

        this.kklcKanjiIndex = await this.fetchJson<KKLCKanjiIndex>(`/data/compiled/index/kklc-kanji.json?v=${Date.now()}`);
        return this.kklcKanjiIndex;
    }

    static async loadKKLCIndex(): Promise<KKLCIndex | null> {
        if (this.kklcIndex) return this.kklcIndex;

        this.kklcIndex = await this.fetchJson<KKLCIndex>(`/data/compiled/index/kklc.json?v=${Date.now()}`);
        return this.kklcIndex;
    }

    static async loadFrequencyIndex(): Promise<FrequencyIndex | null> {
        if (this.frequencyIndex) return this.frequencyIndex;

        this.frequencyIndex = await this.fetchJson<FrequencyIndex>(`/data/compiled/index/frequency.json?v=${Date.now()}`);
        return this.frequencyIndex;
    }

    static async loadJlptIndex(): Promise<JlptIndex | null> {
        if (this.jlptIndex) return this.jlptIndex;

        this.jlptIndex = await this.fetchJson<JlptIndex>(`/data/compiled/index/jlpt.json?v=${Date.now()}`);
        return this.jlptIndex;
    }

    static async loadVocab(id: string): Promise<Vocabulary> {
        if (this.vocabCache.has(id)) {
            return this.vocabCache.get(id)!;
        }

        // A thrown fetch (offline) propagates as-is: a blip must not look like a
        // retired word. Only a definitive "the server does not have this file"
        // (404, or the prod SPA shell served at 200/text/html) becomes
        // VocabNotFoundError so the caller can retire the id instead of crashing.
        const response = await fetch(`/data/compiled/vocab/${id}.json`);
        if (!response.ok || (response.headers.get('content-type') || '').includes('text/html')) {
            throw new VocabNotFoundError(id);
        }
        let vocab: Vocabulary;
        try {
            vocab = await response.json();
        } catch {
            throw new VocabNotFoundError(id);
        }
        this.vocabCache.set(id, vocab);
        return vocab;
    }

    static async loadSearchIndex(): Promise<SearchIndex | null> {
        if (this.searchIndex) return this.searchIndex;

        try {
            this.searchIndex = await this.fetchJson<SearchIndex>(`/data/compiled/index/search.json?v=${Date.now()}`);
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

        this.kanjiIndex = await this.fetchJson<Kanji[]>(`/data/compiled/kanji.json?v=${Date.now()}`);
        for (const k of this.kanjiIndex) this.kanjiByChar.set(k.character, k);
        return this.kanjiIndex;
    }

    static async loadKanji(character: string): Promise<Kanji | null> {
        await this.loadKanjiIndex();
        return this.kanjiByChar.get(character) ?? null;
    }

    static async loadKanjiVocabIndex(): Promise<KanjiVocabIndex> {
        if (this.kanjiVocabIndex) return this.kanjiVocabIndex;

        this.kanjiVocabIndex = await this.fetchJson<KanjiVocabIndex>(`/data/compiled/index/kanji-vocab.json?v=${Date.now()}`);
        return this.kanjiVocabIndex;
    }

    static async loadSentences(vocabId: string): Promise<import('../models/sentence.model').Sentence[] | null> {
        try {
            return await this.fetchJson<import('../models/sentence.model').Sentence[]>(`/data/compiled/sentences/${vocabId}.json`);
            // The file contains an array of sentences directly, or is it a SentenceSet?
            // Based on previous inspection of build-sentences.ts, it generates an array of Sentences?
            // Wait, checking the file content will confirm.
        } catch (e) {
            // No sentences found for this vocab is a valid state
            return null;
        }
    }
}
