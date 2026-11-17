import { useMemo } from "react";
import { searchHeadword, searchSecondaryForm } from "@gokan/dataset-schema";
import type { SearchIndexEntry } from "@gokan/dataset-schema";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { matchesExploreQuery, type ExploreQuery } from "../../../utils/exploreSearch.utils";

function matchesEntry(query: ExploreQuery, entry: SearchIndexEntry | undefined): boolean {
    return entry !== undefined && matchesExploreQuery(query, { english: [entry.m], japanese: [entry.w, entry.r, searchHeadword(entry), searchSecondaryForm(entry)] });
}

/**
 * A search over a list of word ids (a word's related words, a kanji's words) that reads the search
 * index (one file, shared with the header's search), not every word, so a list in the hundreds
 * loads a row's file only when it is shown. `keep` filters ids by the query; searching before the
 * index arrives keeps the ids as they were rather than showing none (`searching`).
 */
export function useIndexSearch(query: ExploreQuery | null): { keep: (ids: readonly string[]) => string[]; searching: boolean } {
    const index = useAsyncData(query ? 'search-index' : null, () => VocabularyService.loadSearchIndex(), { keepPrevious: true }).data;
    const byId = useMemo(() => new Map((index ?? []).map(e => [e.id, e])), [index]);
    const keep = useMemo(
        () => (ids: readonly string[]) => (query && index ? ids.filter(id => matchesEntry(query, byId.get(id))) : [...ids]),
        [query, index, byId],
    );
    return { keep, searching: query !== null && index === undefined };
}
