import { defineParams } from '@sveltejs/kit/params';
// Explicit .ts paths to modules with no import of their own: SvelteKit 3 loads this file under
// Node itself, which resolves neither an extensionless import nor import.meta.env.
import { isSearchIndexPart } from './lib/searchIndexParts.ts';
import { isLocaleSegmentOf, servedLocaleNamedIn, servedLocalesOf } from './lib/servedLocales.ts';

/**
 * The served locales, from the build's setting as lib/locale.ts reads it (lib/site.ts): Vite
 * replaces import.meta.env in the server it builds, and under Node, where SvelteKit loads this
 * file while building, the same variable is in the environment.
 */
const SERVED = servedLocalesOf(import.meta.env ? import.meta.env.VITE_DICTIONARY_LOCALES : process.env.VITE_DICTIONARY_LOCALES);

/** The parameter itself when it matches, so a route reads the string its path holds. */
const when = (matches: (param: string) => boolean) => (param: string): string | undefined => (matches(param) ? param : undefined);

/** Every route parameter matcher (SvelteKit 3: one file, in place of src/params/). */
export const params = defineParams({
    /** A served locale's segment (/dictionary/zh-hans/...); never "en", whose pages have none. */
    locale: when(segment => isLocaleSegmentOf(SERVED, segment)),
    /** A served locale by its name, English's included: a locale's sitemap (sitemap-en.xml). */
    servedLocale: when(name => servedLocaleNamedIn(SERVED, name) !== undefined),
    /** A word's id: digits, so /vocab/jlpt-n5/ is never read as a word. */
    wordId: when(param => /^\d+$/.test(param)),
    /** A list's page number after the first, which has none: 2, 3... */
    listPage: when(param => /^[1-9]\d*$/.test(param) && param !== '1'),
    /** A JLPT level, 1 to 5. */
    jlptLevel: when(param => /^[1-5]$/.test(param)),
    /** One of the search index's two files: core or full (SEARCH_INDEX_PARTS). */
    searchIndexPart: when(isSearchIndexPart),
});