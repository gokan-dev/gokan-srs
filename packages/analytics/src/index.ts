/**
 * Visitor counts for both apps come from Umami Cloud: a cookieless script that counts only
 * browsers running JavaScript, so crawlers (which fetch every dictionary page) stay out of the
 * numbers, and SPA route changes are counted without any code in the app.
 *
 * The website id is not a secret (it is in every page) but it is passed in rather than written
 * here: only the production deploy sets it (VITE_UMAMI_WEBSITE_ID, from the UMAMI_WEBSITE_ID
 * repository variable), so local, CI and staging builds carry no tag and never count a visit.
 */
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';

/**
 * Umami ignores every other host, so a `vite preview` of a production build or a mirror of the
 * static dictionary is never counted as the site. Both apps are served from this one host.
 */
const PRODUCTION_HOST = 'gokan-srs.com';

/** The `<script>` tag to put in a page's `<head>`, or "" when this build has no website id. */
export function analyticsScriptTag(websiteId: string | undefined): string {
    const id = websiteId?.trim();
    if (!id) return '';
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`Umami website id "${id}" is not a UUID`);
    return `<script defer src="${UMAMI_SCRIPT_URL}" data-website-id="${id}" data-domains="${PRODUCTION_HOST}"></script>`;
}

/**
 * A link from the dictionary into the app's setup (gokan-srs issue #243): `order` and `known`
 * open onboarding on the visitor's book and count, and `utm_content` names the placement the
 * link sat in. The dictionary writes these links and the app reads them, so both use these
 * names and this list: a placement not in it is counted as a direct visit.
 */
export const SETUP_LINK_PARAMS = { order: 'order', known: 'known' } as const;

/** The `utm_source` the dictionary's links carry. */
export const DICTIONARY_SOURCE = 'dictionary';

/** Where on a dictionary page a link into the app sits (its `utm_content`). */
export const DICTIONARY_PLACEMENTS = ['word', 'kanji', 'range', 'order', 'grammar', 'home', 'footer', 'about'] as const;

export type DictionaryPlacement = (typeof DICTIONARY_PLACEMENTS)[number];

/**
 * Where `setup_completed` says a learner came from: a dictionary placement's link, or anything
 * else (a typed address, a search result, a link not in the list).
 */
export type SetupSource = `dictionary-${DictionaryPlacement}` | 'direct';

/**
 * The app's page for a word. The app's `vocabPath` builds on it and the dictionary's word pages
 * link through it, so a change to the route moves both.
 */
export function appVocabPath(vocabId: string): string {
    return `/vocab/${encodeURIComponent(vocabId)}`;
}

export function isDictionaryPlacement(value: string | null | undefined): value is DictionaryPlacement {
    return (DICTIONARY_PLACEMENTS as readonly (string | null | undefined)[]).includes(value);
}
