import type { SearchWordRow } from '@gokan/dataset-schema';
import { sharedRequest } from './http';
import { prepareAppSearch, searchApp, wordRowsById, type AppSearchIndex, type AppSearchResults } from '../utils/search.utils';

/**
 * The header search's index, built once: every word, kanji and grammar point, a module the build
 * writes from the dataset (vite.config.ts, `virtual:gokan-search-entries`, in the dictionary's
 * row format) and loads only with the first search.
 */
const entries = sharedRequest(() => import('virtual:gokan-search-entries'));
const index = sharedRequest(async (): Promise<AppSearchIndex> => {
    const { words, kanji, grammar } = await entries.get();
    return prepareAppSearch({ w: words, k: kanji, g: grammar });
});
/** The same module's word rows by id, for the panel searches: the app's one word index. */
const wordRows = sharedRequest(async () => wordRowsById({ w: (await entries.get()).words }));

export const SearchService = {
    /** Every word, kanji and grammar point matching `query`, as one list best first (searchApp). */
    async search(query: string): Promise<AppSearchResults> {
        return searchApp(await index.get(), query);
    },
    /** Every word's search row by id (headword, secondary form, short gloss): what a panel search matches against. */
    wordRows(): Promise<ReadonlyMap<string, SearchWordRow>> {
        return wordRows.get();
    },
};
