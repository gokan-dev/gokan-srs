// The locales the dictionary knows, and which of them a build setting serves. Its own module with
// no import: src/params.ts reads it, and SvelteKit 3 loads that file under Node itself, which
// resolves neither an extensionless import nor import.meta.env. lib/locale.ts holds the rest.

export const LOCALES = ['en', 'zh-hans'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * A locale pages may be rendered in: every locale has a catalog (lib/messages, typed per locale)
 * and a dataset language, so any of them can be served. Which are is SERVED_LOCALES (lib/locale.ts).
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

/** Whether `segment` is a locale segment written in URLs among `served`: never English, whose pages have none. */
export function isLocaleSegmentOf(served: readonly ServedLocale[], segment: string): boolean {
    return served.some(locale => locale !== DEFAULT_LOCALE && locale === segment);
}

/** One of `served` by its name, English's included; undefined for any other name. */
export function servedLocaleNamedIn(served: readonly ServedLocale[], name: string): ServedLocale | undefined {
    return served.find(locale => locale === name);
}