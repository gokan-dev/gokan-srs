/**
 * What a route tells search engines: index it under its own URL, defer to the dictionary page
 * it duplicates, or stay out of the index.
 *
 * The app is one index.html for every route, so a canonical written there claimed every page
 * was the homepage, and Google dropped /about as a duplicate of /. Each route now declares its
 * own (`RouteSeo`, rendered once in App, hoisted into <head> by React).
 */
export type RouteSeo =
    | { kind: 'canonical'; path: string }
    | { kind: 'noindex' };

/** Where gokan-dictionary is served on the same origin (its BASE_PATH). */
const DICTIONARY_BASE = '/dictionary';

/** Routes whose content is the same for every visitor, indexed under their own URL. */
const PUBLIC_PATHS = new Set(['/', '/about']);

/**
 * App detail routes that show a dictionary entry, and that entry's dictionary page. Each app id
 * names exactly one dictionary page: the dictionary writes one per vocab file, per kanji, per
 * grammar point and per grammar family id, and the app's family route is keyed by a contrast
 * entry, whose keys are family ids. Anything else under these prefixes (a second segment) is
 * not a dictionary entry and falls through to noindex.
 */
const DICTIONARY_ROUTES: { prefix: string; page: (segment: string) => string }[] = [
    { prefix: '/vocab/', page: id => `/vocab/${id}/` },
    { prefix: '/kanji/', page: character => `/kanji/${character}/` },
    { prefix: '/grammar/family/', page: id => `/grammar/family/${id}/` },
    { prefix: '/grammar/', page: id => `/grammar/${id}/` },
];

/** Grammar routes that are app screens, not grammar point ids. */
const GRAMMAR_SCREENS = new Set(['browse', 'chapters', 'family']);

/**
 * The SEO of a route, from its pathname as the router reports it (percent-encoded). Personal
 * and session routes (the quiz, stats, settings, the lists and the listening library) show the
 * visitor's own state, so they are noindex.
 */
export function routeSeo(pathname: string): RouteSeo {
    const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    if (PUBLIC_PATHS.has(path)) return { kind: 'canonical', path };

    for (const { prefix, page } of DICTIONARY_ROUTES) {
        if (!path.startsWith(prefix)) continue;
        const segment = path.slice(prefix.length);
        if (segment === '' || segment.includes('/')) return { kind: 'noindex' };
        if (prefix === '/grammar/' && GRAMMAR_SCREENS.has(segment)) return { kind: 'noindex' };
        let decoded: string;
        try {
            decoded = decodeURIComponent(segment);
        } catch {
            return { kind: 'noindex' };
        }
        // Encoded the way the dictionary's own links are (kanjiPath), so both spell one URL.
        return { kind: 'canonical', path: `${DICTIONARY_BASE}${page(encodeURIComponent(decoded))}` };
    }
    return { kind: 'noindex' };
}
