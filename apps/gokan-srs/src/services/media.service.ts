import type { MediaIndexEntry, MediaLibraryWords, MediaTitle } from '@gokan/dataset-schema';
import { datasetUrl, fetchJson } from './http';

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

    static async loadIndex(): Promise<MediaIndexEntry[]> {
        if (this.index) return this.index;
        this.index = await fetchJson<MediaIndexEntry[]>(datasetUrl('media/index.json'));
        return this.index;
    }

    static async loadTitle(id: string): Promise<MediaTitle> {
        const cached = this.titleCache.get(id);
        if (cached) return cached;
        const title = await fetchJson<MediaTitle>(datasetUrl(`media/${encodeURIComponent(id)}.json`));
        this.titleCache.set(id, title);
        return title;
    }

    /** Every title's whole-series word list, for ranking the library by coverage without loading each title file. */
    static async loadLibraryWords(): Promise<MediaLibraryWords> {
        if (this.libraryWords) return this.libraryWords;
        this.libraryWords = await fetchJson<MediaLibraryWords>(datasetUrl('media/library.json'));
        return this.libraryWords;
    }
}
