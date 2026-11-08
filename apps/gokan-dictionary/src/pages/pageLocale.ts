// The locale a page is rendered in, for the components under it: the root layout
// (routes/+layout.svelte) sets it once from the route's locale segment, and a component reads its
// links and its words from it, rather than each page passing them down through every component.

import { createContext } from 'svelte';
import type { ServedLocale } from '../lib/locale';
import { messagesFor, type Messages } from '../lib/messages';
import { localeUrls, type LocaleUrls } from '../lib/urls';

export interface PageLocale {
    locale: ServedLocale;
    /** Every link a component writes. */
    urls: LocaleUrls;
    /** Every word of chrome a component shows. */
    messages: Messages;
}

// Typed by construction; reading it outside the root layout throws (Svelte's missing_context).
const [getPageLocale, setContext] = createContext<PageLocale>();

export function setPageLocale(locale: ServedLocale): void {
    setContext({ locale, urls: localeUrls(locale), messages: messagesFor(locale) });
}

export const pageLocale = getPageLocale;
