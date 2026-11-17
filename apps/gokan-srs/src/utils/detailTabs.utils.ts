/**
 * A tabbed detail page's tabs (a word's, a kanji's, a grammar point's): their order in the row,
 * each but the first (the essentials, the page's default) with a URL hash, and the session-storage
 * key the last chosen one is remembered under, across subjects of the same kind
 * (`usePersistedControls`). The tab state that runs on them is `useDetailTabs`.
 */
export interface DetailTabSet<T extends string> {
    /** In the row's order; the first is the essentials, which has no hash. */
    tabs: readonly T[];
    first: T;
    storageKey: string;
    /** A tab's URL hash: none for the first. */
    hashOf: (tab: T) => string;
    /** The tab a URL hash names, or null when it names none (no hash, the first's name, anything else). */
    tabOfHash: (hash: string) => T | null;
    /**
     * The tab a page opens on: the URL's hash first, else the tab last chosen (on any subject of
     * its kind, this browser session), else the first. A tab this subject does not have gives way
     * to the next rule down.
     */
    initial: (hash: string, remembered: unknown, available: readonly T[]) => T;
}

export function detailTabSet<T extends string>(tabs: readonly [T, ...T[]], hashes: Record<T, string>, storageKey: string): DetailTabSet<T> {
    const [first] = tabs;
    const isTab = (value: unknown): value is T => tabs.some(tab => tab === value);
    const tabOfHash = (hash: string): T | null => (hash === '' ? null : tabs.find(tab => hashes[tab] === hash) ?? null);
    return {
        tabs,
        first,
        storageKey,
        hashOf: tab => hashes[tab],
        tabOfHash,
        initial: (hash, remembered, available) => {
            const linked = tabOfHash(hash);
            if (linked && available.includes(linked)) return linked;
            if (isTab(remembered) && available.includes(remembered)) return remembered;
            return first;
        },
    };
}

/** A kanji's page: the kanji in brief, every word using it, the learner's words with it. */
export const KANJI_TABS = detailTabSet(['kanji', 'words', 'study'], { kanji: '', words: '#words', study: '#study' }, 'gokan.kanjiPage.tab');

/** A grammar point's page: the point in brief, every example, its related points, the learner's study. */
export const GRAMMAR_TABS = detailTabSet(
    ['point', 'examples', 'related', 'study'],
    { point: '', examples: '#examples', related: '#related', study: '#study' },
    'gokan.grammarPage.tab',
);
