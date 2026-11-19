import { detailTabSet } from './detailTabs.utils';

/**
 * A word page's tabs, in the order the row shows them (each only when it has content), named in
 * the singular as their panels are (the sentence tab); their hashes are the plural.
 */
export const WORD_TAB_SET = detailTabSet(
    ['dict', 'sentence', 'synonym', 'kanji', 'related', 'study'],
    {
        dict: '',
        sentence: '#sentences',
        synonym: '#synonyms',
        kanji: '#kanji',
        related: '#related',
        study: '#study',
    },
    'gokan.wordPage.tab',
);
export const WORD_TABS = WORD_TAB_SET.tabs;
export type WordTab = typeof WORD_TABS[number];

/** A tab's URL hash: none for Dict, the page's default; `#synonyms` for Synonyms (a quiz's "Compare synonyms"). */
export const wordTabHash = WORD_TAB_SET.hashOf;

/** The tab a URL hash names, or null when it names none (no hash, `#dict`, anything else). */
export const wordTabOfHash = WORD_TAB_SET.tabOfHash;

/**
 * The tab a word page opens on: the URL's hash first, else the tab last chosen (on any word,
 * this browser session), else Dict. A tab this word does not have gives way to the next rule
 * down, so 今 linked as `#study` but not studied opens on the remembered tab or Dict.
 */
export const initialWordTab = WORD_TAB_SET.initial;
