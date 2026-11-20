// The kanji and grammar rows of the header search, written from the dataset by the build
// (vite.config.ts, searchEntriesPlugin) in the shared row format (@gokan/dataset-schema).
declare module 'virtual:gokan-search-entries' {
    import type { SearchGrammarRow, SearchKanjiRow } from '@gokan/dataset-schema';

    export const kanji: SearchKanjiRow[];
    export const grammar: SearchGrammarRow[];
}
