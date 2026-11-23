import { sharedRequest } from './http';
import { VocabularyService } from './vocabulary.service';
import { prepareAppSearch, searchApp, type AppSearchIndex, type AppSearchResults } from '../utils/search.utils';

/**
 * The header search's index, built once: the words of index/search.json (shared with the panel
 * searches, useIndexSearch) and the kanji and grammar rows, a module the build writes from the
 * dataset (vite.config.ts, `virtual:gokan-search-entries`) and loads only with the first search.
 */
const index = sharedRequest(async (): Promise<AppSearchIndex> => {
    const [words, entries] = await Promise.all([VocabularyService.loadSearchIndex(), import('virtual:gokan-search-entries')]);
    return prepareAppSearch(words ?? [], entries.kanji, entries.grammar);
});

export const SearchService = {
    /** Every word, kanji and grammar point matching `query`, as one list best first (searchApp). */
    async search(query: string): Promise<AppSearchResults> {
        return searchApp(await index.get(), query);
    },
};
