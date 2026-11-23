import { useMemo } from "react";
import { useAsyncData } from "../../hooks/useAsyncData";
import { SearchService } from "../../services/search.service";
import type { ExploreQuery } from "../../utils/exploreSearch.utils";
import { matchesWordRow } from "../../utils/search.utils";

/**
 * A search over a list of word ids (a word's related words, a kanji's words) that reads the header
 * search's word rows (`SearchService.wordRows`, the one word index the app downloads: headword,
 * secondary form, short gloss), not every word, so a list in the hundreds loads a row's file only
 * when it is shown. `keep` filters ids by the query; searching before the rows arrive keeps the
 * ids as they were rather than showing none (`searching`).
 */
export function useIndexSearch(query: ExploreQuery | null): { keep: (ids: readonly string[]) => string[]; searching: boolean } {
    const rows = useAsyncData(query ? 'search-word-rows' : null, () => SearchService.wordRows(), { keepPrevious: true }).data;
    const keep = useMemo(
        () => (ids: readonly string[]) => (query && rows ? ids.filter(id => matchesWordRow(query, rows.get(id))) : [...ids]),
        [query, rows],
    );
    return { keep, searching: query !== null && rows === undefined };
}
