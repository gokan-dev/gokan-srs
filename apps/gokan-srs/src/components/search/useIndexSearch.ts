import { useMemo } from "react";
import { useAsyncData } from "../../hooks/useAsyncData";
import { SearchService } from "../../services/search.service";
import type { ExploreQuery } from "../../utils/exploreSearch.utils";
import { SEARCHING, SEARCH_UNAVAILABLE, matchesWordRow } from "../../utils/search.utils";

/**
 * A search over a list of word ids (a word's related words, a kanji's words) that reads the header
 * search's word rows (`SearchService.wordRows`, the one word index the app downloads: headword,
 * secondary form, short gloss), not every word, so a list in the hundreds loads a row's file only
 * when it is shown. `keep` filters ids by the query; searching before the rows arrive, or when they
 * could not load, keeps the ids as they were rather than showing none. `notice` is what the count
 * line says instead of a count meanwhile: Searching… while the rows load, the header search's
 * unavailable line when they failed (never Searching… for good), null once they are in.
 */
export function useIndexSearch(query: ExploreQuery | null): { keep: (ids: readonly string[]) => string[]; notice: string | null } {
    const load = useAsyncData(query ? 'search-word-rows' : null, () => SearchService.wordRows(), { keepPrevious: true });
    const rows = load.data;
    const keep = useMemo(
        () => (ids: readonly string[]) => (query && rows ? ids.filter(id => matchesWordRow(query, rows.get(id))) : [...ids]),
        [query, rows],
    );
    const notice = query === null || rows !== undefined ? null : load.status === 'error' ? SEARCH_UNAVAILABLE : SEARCHING;
    return { keep, notice };
}
