// The locale a page is rendered in, for the components under it: the root layout
// (routes/+layout.svelte) sets it once from the route's locale segment, and a component reads its
// links and its words from it, rather than each page passing them down through every component.
// A page in another locale links its own section's pages, and English's for the page types it does
// not serve yet, marked (lib/localeLinks.ts).

import { createContext } from 'svelte';
import { htmlLang, type ServedLocale } from '../lib/locale';
import { messagesFor, type Messages } from '../lib/messages';
import { linkLang, linkUrls } from '../lib/localeLinks';
import type { LocaleUrls } from '../lib/urls';

export interface PageLocale {
    locale: ServedLocale;
    /** The page's language as a lang attribute (htmlLang): for its own words inside Japanese or English. */
    lang: string;
    /** Every link a component writes: to a page served in the locale, else to English's. */
    urls: LocaleUrls;
    /** A link's hreflang: "en" for one leaving a section other than English's (localeLinks.ts). */
    linkLang: (href: string) => 'en' | undefined;
    /** Every word of chrome a component shows. */
    messages: Messages;
}

// Typed by construction; reading it outside the root layout throws (Svelte's missing_context).
const [getPageLocale, setContext] = createContext<PageLocale>();

export function setPageLocale(locale: ServedLocale): void {
    setContext({ locale, lang: htmlLang(locale), urls: linkUrls(locale), linkLang: href => linkLang(locale, href), messages: messagesFor(locale) });
}

export const pageLocale = getPageLocale;
