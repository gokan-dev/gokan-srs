/**
 * A word page's tabs, in the order the row shows them (each only when it has content), named in
 * the singular as their panels are (the sentence tab); their hashes are the plural.
 */
export const WORD_TABS = ['dict', 'sentence', 'synonym', 'kanji', 'related', 'study'] as const;
export type WordTab = typeof WORD_TABS[number];

const HASH: Record<WordTab, string> = {
    dict: '',
    sentence: '#sentences',
    synonym: '#synonyms',
    kanji: '#kanji',
    related: '#related',
    study: '#study',
};

/** The session-storage key the last chosen tab is remembered under, across words (`usePersistedControls`). */
export const WORD_TAB_STORAGE_KEY = 'gokan.wordPage.tab';

const isWordTab = (value: unknown): value is WordTab => WORD_TABS.some(tab => tab === value);

/** A tab's URL hash: none for Dict, the page's default; `#synonyms` for Synonyms (a quiz's "Compare synonyms"). */
export function wordTabHash(tab: WordTab): string {
    return HASH[tab];
}

/** The tab a URL hash names, or null when it names none (no hash, `#dict`, anything else). */
export function wordTabOfHash(hash: string): WordTab | null {
    return hash === '' ? null : WORD_TABS.find(tab => HASH[tab] === hash) ?? null;
}

/**
 * The tab a word page opens on: the URL's hash first, else the tab last chosen (on any word,
 * this browser session), else Dict. A tab this word does not have gives way to the next rule
 * down, so 今 linked as `#study` but not studied opens on the remembered tab or Dict.
 */
export function initialWordTab(hash: string, remembered: unknown, available: readonly WordTab[]): WordTab {
    const linked = wordTabOfHash(hash);
    if (linked && available.includes(linked)) return linked;
    if (isWordTab(remembered) && available.includes(remembered)) return remembered;
    return 'dict';
}
