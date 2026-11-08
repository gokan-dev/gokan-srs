// The languages the dictionary is written in, and how each is addressed. English keeps the URLs
// the site has always had; another locale lives under its own segment (/dictionary/zh-hans/...).
// A locale is served once its message catalog (lib/messages) and its dataset text exist (#170);
// until then its routes match nothing, so no page is rendered in it.

export const LOCALES = ['en', 'zh-hans'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE = 'en' satisfies Locale;

/** The locales pages are rendered in. A locale added here needs a catalog, or the build fails. */
export const SERVED_LOCALES = ['en'] as const satisfies readonly Locale[];
export type ServedLocale = (typeof SERVED_LOCALES)[number];

/** The language of the dataset's text a locale reads (its `text/<language>/` files). */
export type DatasetLanguage = 'en';

const DATASET_LANGUAGE: Record<ServedLocale, DatasetLanguage> = { en: 'en' };

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
 * segment, so one page has one address. No module-level state, so a bundle that imports this
 * module keeps only what it calls.
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
