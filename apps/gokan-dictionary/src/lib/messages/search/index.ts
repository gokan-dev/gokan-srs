// What the search script (client/search.ts) says, per locale: one typed module per locale, as the
// page catalog (../index.ts), but apart from it, so the script bundles these words alone. The
// script is linked from every page by its content hash, and the bundler hashes what it imports:
// a word changed in the page catalog must not rename it, and with it every page.

import type { Locale } from '../../locale';
import { enSearch } from './en';
import { zhHansSearch } from './zh-hans';

/** A sentence with a Japanese run in it (a kana, a conjugated form): the text before and after it. */
export interface AroundJapanese {
    before: string;
    after: string;
}

export interface SearchMessages {
    /** While the index and the query engine load, on first focus. */
    loading: string;
    /** When they could not be loaded. */
    unavailable: string;
    /** On the results page before the index has answered. */
    searching: string;
    /** On the results page with no query. */
    emptyQuery: string;
    /** The panel's groups and the results page's sections. */
    groups: { words: string; kanji: string; grammar: string };
    /** The results page's Words heading, with the count. */
    wordsHeading: (count: number) => string;
    /** The panel's last row. */
    seeAll: (query: string) => string;
    /** The results page's heading for a query. */
    resultsFor: (query: string) => string;
    /** The results page's pager's accessible name. */
    resultPages: string;
    /** "No results for “xyz”.", then the kana a romaji query was read as, and where to go instead. */
    noResults: (query: string) => string;
    searchedAs: AroundJapanese;
    tryInstead: string;
    /** A word found from a conjugated query: "from 食べた · ", before its gloss. */
    fromForm: AroundJapanese;
    /** The live region's announcement. */
    status: (count: number) => string;
    /** A kanji result's level on the results page, or that it has none. */
    kanjiLevel: (level: number) => string;
    outsideJlpt: string;
}

const SEARCH: Record<Locale, SearchMessages> = { en: enSearch, 'zh-hans': zhHansSearch };

export function searchMessagesFor(locale: Locale): SearchMessages {
    return SEARCH[locale];
}
