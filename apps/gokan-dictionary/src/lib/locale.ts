// The languages the dictionary is written in, and how each is addressed. English keeps the URLs
// the site has always had; another locale lives under its own segment (/dictionary/zh-hans/...).
// Which locales a build serves is a build setting (VITE_DICTIONARY_LOCALES, lib/site.ts): English
// alone in production, Chinese too on staging (#170). A locale not served has routes that match
// nothing, so no page is rendered in it.

import { DICTIONARY_LOCALES } from './site';

export const LOCALES = ['en', 'zh-hans'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * A locale pages may be rendered in: every locale has a catalog (lib/messages, typed per locale)
 * and a dataset language, so any of them can be served. Which are is SERVED_LOCALES.
 */
export type ServedLocale = Locale;

export const DEFAULT_LOCALE = 'en' satisfies Locale;

const isLocale = (name: string): name is Locale => LOCALES.some(locale => locale === name);

/**
 * The locales a build setting names (space-separated, "en zh-hans"), in LOCALES' order. Unset or
 * blank is English alone. A name that is not a locale, or a list without English (whose pages
 * keep the site's URLs, its search index and its sitemap), fails the build: never a silent fall
 * back to English.
 */
export function servedLocalesOf(setting: string | undefined): readonly ServedLocale[] {
    const names = (setting ?? '').split(/\s+/).filter(name => name !== '');
    if (names.length === 0) return [DEFAULT_LOCALE];
    const unknown = names.filter(name => !isLocale(name));
    if (unknown.length > 0) throw new Error(`[locale] VITE_DICTIONARY_LOCALES names ${unknown.map(name => `"${name}"`).join(', ')}, not a locale (${LOCALES.join(', ')}).`);
    if (!names.includes(DEFAULT_LOCALE)) throw new Error(`[locale] VITE_DICTIONARY_LOCALES "${setting}" leaves out ${DEFAULT_LOCALE}: English is always served.`);
    return LOCALES.filter(locale => names.includes(locale));
}

/**
 * The locales pages are rendered in: the build's setting. Marked pure so a bundle that imports
 * this module for one function (the search script, through urls.ts) drops the call: kept, it
 * would change the script's bytes, and with its content hash every page that links it.
 */
export const SERVED_LOCALES: readonly ServedLocale[] = /* @__PURE__ */ servedLocalesOf(DICTIONARY_LOCALES);

/** The language of the dataset's text a locale reads (its `text/<language>/` files). */
export type DatasetLanguage = 'en' | 'zh-hans';

const DATASET_LANGUAGE: Record<ServedLocale, DatasetLanguage> = { en: 'en', 'zh-hans': 'zh-hans' };

export function datasetLanguageOf(locale: ServedLocale): DatasetLanguage {
    return DATASET_LANGUAGE[locale];
}

/** The BCP 47 tag for <html lang>: "en", "zh-Hans". */
const HTML_LANG: Record<Locale, string> = { en: 'en', 'zh-hans': 'zh-Hans' };

export function htmlLang(locale: Locale): string {
    return HTML_LANG[locale];
}

/** English, whose pages have no locale segment. Typed wide, so it reads the same once more locales are served. */
function isDefaultLocale(locale: Locale): boolean {
    return locale === DEFAULT_LOCALE;
}

/** What a locale adds to every path after the base path: nothing for English, "/zh-hans" otherwise. */
export function localePrefix(locale: Locale): string {
    return isDefaultLocale(locale) ? '' : `/${locale}`;
}

/**
 * Whether a path segment names a served locale written in URLs: never "en", whose pages have no
 * segment, so one page has one address.
 */
export function isLocaleSegment(segment: string): boolean {
    return SERVED_LOCALES.some(locale => !isDefaultLocale(locale) && locale === segment);
}

/** The locale of a route's optional locale segment: none is English. */
export function localeOfSegment(segment: string | undefined): ServedLocale {
    if (segment === undefined) return DEFAULT_LOCALE;
    const locale = SERVED_LOCALES.find(candidate => !isDefaultLocale(candidate) && candidate === segment);
    if (locale === undefined) throw new Error(`[locale] "${segment}" is not a locale segment`);
    return locale;
}

/**
 * A route's prerender entries in every served locale: English's as they are, another locale's
 * with its segment.
 */
export async function inEveryLocale<Params extends Record<string, string>>(
    entriesOf: (locale: ServedLocale) => Promise<Params[]>,
): Promise<(Params & { locale?: string })[]> {
    const perLocale = await Promise.all(SERVED_LOCALES.map(async locale => {
        const entries = await entriesOf(locale);
        return isDefaultLocale(locale) ? entries : entries.map(entry => ({ ...entry, locale }));
    }));
    return perLocale.flat();
}
