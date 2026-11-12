// The search index's two files by name. Its own module with no import: src/params.ts reads it,
// and SvelteKit 3 loads that file under Node itself (see lib/servedLocales.ts).

/** The index's two files (splitSearchIndex), by the name each is served under: search-core.json, search-full.json. */
export const SEARCH_INDEX_PARTS = ['core', 'full'] as const;
export type SearchIndexPart = (typeof SEARCH_INDEX_PARTS)[number];

export function isSearchIndexPart(name: string): name is SearchIndexPart {
    return SEARCH_INDEX_PARTS.some(part => part === name);
}