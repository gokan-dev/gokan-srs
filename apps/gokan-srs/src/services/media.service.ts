import type { MediaIndexEntry, MediaLibraryWords, MediaTitle } from '@gokan/dataset-schema';
import { fetchDatasetFile, RequestCache, sharedRequest } from './http';

/**
 * Loads the listening library compiled by the gokan-dataset submodule's
 * scripts/build-media.ts into compiled/media/, synced into
 * published under /dataset/media/ like every other dataset. Same fetch + in-memory
 * cache pattern as GrammarService.
 */
export class MediaService {
    private static index = sharedRequest(() => fetchDatasetFile<MediaIndexEntry[]>('media/index.json'));
    private static titles = new RequestCache(id => fetchDatasetFile<MediaTitle>(`media/${encodeURIComponent(id)}.json`));
    private static libraryWords = sharedRequest(() => fetchDatasetFile<MediaLibraryWords>('media/library.json'));

    static loadIndex(): Promise<MediaIndexEntry[]> {
        return this.index.get();
    }

    static loadTitle(id: string): Promise<MediaTitle> {
        return this.titles.get(id);
    }

    /** Every title's whole-series word list, for ranking the library by coverage without loading each title file. */
    static loadLibraryWords(): Promise<MediaLibraryWords> {
        return this.libraryWords.get();
    }
}
