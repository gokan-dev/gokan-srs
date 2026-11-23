// The header search's word, kanji and grammar rows, written from the dataset by the build
// (vite.config.ts, searchEntriesPlugin) in the shared format (@gokan/dataset-schema's searchRows.ts).
declare module 'virtual:gokan-search-entries' {
    import type { SearchGrammarRow, SearchKanjiColumns, SearchWordColumns } from '@gokan/dataset-schema';

    export const words: SearchWordColumns;
    export const kanji: SearchKanjiColumns;
    export const grammar: SearchGrammarRow[];
}
