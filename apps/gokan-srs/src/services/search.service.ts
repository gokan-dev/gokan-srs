import { sharedRequest } from './http';
import { VocabularyService } from './vocabulary.service';
import { prepareAppSearch, SEARCH_LIMITS, searchApp, type AppSearchIndex, type AppSearchResults, type SearchLimits } from '../utils/search.utils';

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
    /** Words, kanji and grammar points for `query`, each group best first and capped at `limits` (searchApp; the desktop dropdown's are `DROPDOWN_SEARCH_LIMITS`). */
    async search(query: string, limits: SearchLimits = SEARCH_LIMITS): Promise<AppSearchResults> {
        return searchApp(await index.get(), query, limits);
    },
};
