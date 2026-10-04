import type { MediaIndexEntry, MediaLibraryWords, MediaTitle } from '../models/media.model';

/**
 * Loads the listening library compiled by the gokan-dataset submodule's
 * scripts/build-media.ts into compiled/media/, synced into
 * public/data/compiled/media/ like every other dataset. Same fetch + in-memory
 * cache pattern as GrammarService.
 */
export class MediaService {
    private static index: MediaIndexEntry[] | null = null;
    private static titleCache = new Map<string, MediaTitle>();
    private static libraryWords: MediaLibraryWords | null = null;

    private static async fetchJson<T>(path: string): Promise<T> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
        }
        return response.json();
    }

    static async loadIndex(): Promise<MediaIndexEntry[]> {
        if (this.index) return this.index;
        this.index = await this.fetchJson<MediaIndexEntry[]>(`/data/compiled/media/index.json?v=${Date.now()}`);
        return this.index;
    }

    static async loadTitle(id: string): Promise<MediaTitle> {
        const cached = this.titleCache.get(id);
        if (cached) return cached;
        const title = await this.fetchJson<MediaTitle>(`/data/compiled/media/${encodeURIComponent(id)}.json`);
        this.titleCache.set(id, title);
        return title;
    }

    /** Every title's whole-series word list, for ranking the library by coverage without loading each title file. */
    static async loadLibraryWords(): Promise<MediaLibraryWords> {
        if (this.libraryWords) return this.libraryWords;
        this.libraryWords = await this.fetchJson<MediaLibraryWords>(`/data/compiled/media/library.json?v=${Date.now()}`);
        return this.libraryWords;
    }
}
