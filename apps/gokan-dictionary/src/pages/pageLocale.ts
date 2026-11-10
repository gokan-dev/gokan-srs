// The locale a page is rendered in, for the components under it: the root layout
// (routes/+layout.svelte) sets it once from the route's locale segment, and a component reads its
// links and its words from it, rather than each page passing them down through every component.
// A page in another locale links only to pages served in it (lib/localeLinks.ts): a word page
// names the words it links that have one (setLinkedWordPages), for every component under it.

import { createContext } from 'svelte';
import type { ServedLocale } from '../lib/locale';
import { messagesFor, type Messages } from '../lib/messages';
import { linkUrls } from '../lib/localeLinks';
import type { LocaleUrls } from '../lib/urls';

export interface PageLocale {
    locale: ServedLocale;
    /** Every link a component writes: to a page served in the locale, else to English's. */
    urls: LocaleUrls;
    /** Every word of chrome a component shows. */
    messages: Messages;
}

// Typed by construction; reading it outside the root layout throws (Svelte's missing_context).
const [getPageLocale, setContext] = createContext<PageLocale>();

export function setPageLocale(locale: ServedLocale): void {
    setContext({ locale, urls: linkUrls(locale, new Set()), messages: messagesFor(locale) });
}

/**
 * On a word page: the words it links that have a page in its locale (its page model's
 * wordsInLocale), linked there by every component under it. Returns the page's locale with them.
 */
export function setLinkedWordPages(wordIds: readonly string[]): PageLocale {
    const current = getPageLocale();
    const linked = { ...current, urls: linkUrls(current.locale, new Set(wordIds)) };
    setContext(linked);
    return linked;
}

export const pageLocale = getPageLocale;
