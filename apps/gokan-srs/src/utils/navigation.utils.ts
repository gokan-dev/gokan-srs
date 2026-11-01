import { wordTabHash, type WordTab } from './wordTabs.utils';

/** A destination in the app's navigation (desktop header, mobile tab bar, More sheet). */
export interface NavDestination {
    label: string;
    to: string;
    /** Path prefixes that count as being inside this destination (besides `to` itself). */
    sections: string[];
}

export const STUDY: NavDestination = { label: 'Study', to: '/', sections: [] };
export const VOCABULARY: NavDestination = { label: 'Vocabulary', to: '/vocab', sections: ['/vocab'] };
export const GRAMMAR: NavDestination = { label: 'Grammar', to: '/grammar/chapters', sections: ['/grammar/'] };
export const LISTENING: NavDestination = { label: 'Listening', to: '/listening', sections: ['/listening'] };
export const STATS: NavDestination = { label: 'Stats', to: '/stats', sections: ['/stats'] };
export const KANJI: NavDestination = { label: 'Kanji', to: '/kanji', sections: ['/kanji'] };
export const SETTINGS: NavDestination = { label: 'Settings', to: '/settings', sections: ['/settings'] };
export const ABOUT: NavDestination = { label: 'About', to: '/about', sections: ['/about'] };
export const WHATS_NEW: NavDestination = { label: "What's new", to: '/whats-new', sections: [] };

/** The desktop header's text links, in order (Settings sits apart, on the right). */
export const HEADER_DESTINATIONS = [STUDY, VOCABULARY, GRAMMAR, LISTENING, STATS, KANJI];

/** What the mobile More sheet lists, besides the external Dictionary link. */
export const MORE_DESTINATIONS = [LISTENING, KANJI, SETTINGS, ABOUT, WHATS_NEW];

/** The two study session pages, shown in focus mode (no navigation). */
export function isSessionPath(pathname: string): boolean {
    return pathname === '/quiz' || pathname === '/grammar';
}

function isUnder(pathname: string, prefix: string): boolean {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether `pathname` is inside a destination: a word page is inside Vocabulary,
 * a kanji page inside Kanji, any grammar page (but not the `/grammar` session) inside
 * Grammar. Study is active on the hub only.
 */
export function isDestinationActive(pathname: string, destination: NavDestination): boolean {
    if (pathname === destination.to) return true;
    return destination.sections.some(prefix => isUnder(pathname, prefix));
}

/** Whether the More tab should show as active: the current page is one of its entries. */
export function isMoreActive(pathname: string): boolean {
    return MORE_DESTINATIONS.some(d => isDestinationActive(pathname, d));
}

/** A word's page, open on one of its tabs (Dict, which has no hash, by default). */
export function vocabPath(vocabId: string, tab: WordTab = 'dict'): string {
    return `/vocab/${encodeURIComponent(vocabId)}${wordTabHash(tab)}`;
}

/**
 * A kanji's page. The glyph is one character, never a path separator, so it goes in as written:
 * the URL is the one these pages have always had.
 */
export function kanjiPath(glyph: string): string {
    return `/kanji/${glyph}`;
}

/** A word's Synonyms tab (a quiz's synonym note, "Compare synonyms", links there). */
export function synonymsPath(vocabId: string): string {
    return vocabPath(vocabId, 'synonym');
}
