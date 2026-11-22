// The header search's kanji and grammar rows, as the module `virtual:gokan-search-entries` the
// build serves (vite.config.ts, searchEntriesPlugin): every kanji and grammar point of the dataset
// checkout, through its English view, in the row format the dictionary's index uses too
// (@gokan/dataset-schema's searchRows.ts). Loaded through Vite (runnerImport), not by Node, so
// the workspace packages resolve as the app's own code does.

import { searchGrammarRow, searchKanjiRow, type GrammarBrowseIndex, type Kanji, type SearchGrammarRow, type SearchKanjiRow } from '@gokan/dataset-schema';
import { englishView } from '@gokan/dataset-schema/english';

export interface SearchEntries {
    kanji: SearchKanjiRow[];
    grammar: SearchGrammarRow[];
}

/** Every kanji (kanji.json) and grammar point (the browse index, in teaching order) of `compiledDir`. */
export function searchEntries(compiledDir: string): SearchEntries {
    const view = englishView(compiledDir);
    // The dataset's own build typed each file; the English view gives back the shape the types describe.
    const kanji = view.json('kanji.json') as Kanji[];
    const browse = view.json('grammar/index/browse.json') as GrammarBrowseIndex;
    return { kanji: kanji.map(searchKanjiRow), grammar: browse.points.map(searchGrammarRow) };
}

/** The module's source: its two lists as constants. */
export function searchEntriesModule(compiledDir: string): string {
    const { kanji, grammar } = searchEntries(compiledDir);
    return `export const kanji = ${JSON.stringify(kanji)};\nexport const grammar = ${JSON.stringify(grammar)};\n`;
}
