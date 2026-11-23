import { sharedRequest } from './http';
import { prepareAppSearch, searchApp, type AppSearchIndex, type AppSearchResults } from '../utils/search.utils';

/**
 * The header search's index, built once: every word, kanji and grammar point, a module the build
 * writes from the dataset (vite.config.ts, `virtual:gokan-search-entries`, in the dictionary's
 * row format) and loads only with the first search.
 */
const index = sharedRequest(async (): Promise<AppSearchIndex> => {
    const entries = await import('virtual:gokan-search-entries');
    return prepareAppSearch({ w: entries.words, k: entries.kanji, g: entries.grammar });
});

export const SearchService = {
    /** Every word, kanji and grammar point matching `query`, as one list best first (searchApp). */
    async search(query: string): Promise<AppSearchResults> {
        return searchApp(await index.get(), query);
    },
};
