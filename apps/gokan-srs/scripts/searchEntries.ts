// The header search's index, as the module `virtual:gokan-search-entries` the build serves
// (vite.config.ts, searchEntriesPlugin): every word (in frequency order), kanji and grammar point
// of the dataset checkout, through its English view, in the row format the dictionary's index
// uses (@gokan/dataset-schema's searchRows.ts), built by the same functions from the same files,
// so a query lists the same rows in the same order in both apps (scripts/searchParity.test.ts at
// the root). Loaded through Vite (runnerImport), not by Node, so the workspace packages resolve
// as the app's own code does.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { kanjiToColumns, searchGrammarRow, searchKanjiRow, searchWordRow, toColumns } from '@gokan/dataset-schema';
import type { FrequencyIndex, GrammarBrowseIndex, Kanji, SearchIndexColumns, Vocabulary } from '@gokan/dataset-schema';
import { englishView } from '@gokan/dataset-schema/english';

/** The index's three lists, words and kanji by column (as the dictionary stores them). */
export type SearchEntries = Required<SearchIndexColumns>;

/**
 * Every word with a file, in the frequency index's order (a row's position is its rank, as in the
 * dictionary's index), every kanji (kanji.json) and every grammar point (the browse index, in
 * teaching order) of `compiledDir`.
 */
export function searchEntries(compiledDir: string): SearchEntries {
    const view = englishView(compiledDir);
    // The dataset's own build typed each file; the English view gives back the shape the types describe.
    const frequency = view.json('index/frequency.json') as FrequencyIndex;
    const words = frequency
        .filter(({ id }) => existsSync(path.join(compiledDir, 'vocab', `${id}.json`)))
        .map(({ id }) => searchWordRow(view.json(`vocab/${id}.json`) as Vocabulary));
    const kanji = view.json('kanji.json') as Kanji[];
    const browse = view.json('grammar/index/browse.json') as GrammarBrowseIndex;
    return { w: toColumns(words), k: kanjiToColumns(kanji.map(searchKanjiRow)), g: browse.points.map(searchGrammarRow) };
}

/** The module's source: its three lists as constants. */
export function searchEntriesModule(compiledDir: string): string {
    const { w, k, g } = searchEntries(compiledDir);
    return `export const words = ${JSON.stringify(w)};\nexport const kanji = ${JSON.stringify(k)};\nexport const grammar = ${JSON.stringify(g)};\n`;
}
