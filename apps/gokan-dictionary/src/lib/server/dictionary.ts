// The dictionary's pages over their source: the one place a source of the dataset is chosen. While
// building, every page reads the checkout (dataset.server.ts's checkoutData). On request, an
// entity page reads the published dataset over HTTP (httpData), at the origin the server is given
// (DATASET_ORIGIN: CloudFront in production, a local server in the checks). Each locale's pages
// read the dataset's text in its language (datasetLanguageOf). Built on first use, so importing a
// route resolves no dataset.

import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { checkoutData, resolveCompiledDir } from '../dataset.server';
import { datasetLanguageOf, DEFAULT_LOCALE, inEveryLocale, SERVED_LOCALES, type ServedLocale } from '../locale';
import type { SearchIndexFile } from '../types';
import { httpData } from './httpData';
import { entityPagesOf, PageNotFound, pagesOf, pathOf, type Alternate, type EntityPages, type PageKey, type Pages } from './pages';
import { publishedSourceUrls, stampedSearchIndex } from './rendering';

const built = new Map<ServedLocale, Pages>();
const onRequest = new Map<ServedLocale, EntityPages>();

/**
 * Every page in one locale, over the checkout: what the build prerenders. On request there is no
 * checkout: English's list pages are served as the files the build wrote, and another locale has
 * none yet (#170), so a path the server renders through a list route is a 404.
 */
export function pages(locale: ServedLocale): Pages {
    if (!building && locale !== DEFAULT_LOCALE) throw new PageNotFound(`no ${locale} list pages: only its word pages are served`);
    let localePages = built.get(locale);
    if (localePages === undefined) {
        localePages = pagesOf(checkoutData(resolveCompiledDir(), datasetLanguageOf(locale)), locale);
        built.set(locale, localePages);
    }
    return localePages;
}

/** A word, kanji or grammar point page: over the checkout while building, over HTTP on request. */
export function entityPages(locale: ServedLocale): EntityPages {
    if (building) return pages(locale);
    let localePages = onRequest.get(locale);
    if (localePages === undefined) {
        const origin = env.DATASET_ORIGIN;
        if (!origin) throw new Error('[dictionary] DATASET_ORIGIN is not set: the origin serving /dataset/ and the search index, e.g. https://gokan-srs.com.');
        localePages = entityPagesOf(httpData({ ...publishedSourceUrls(origin), language: datasetLanguageOf(locale) }), locale);
        onRequest.set(locale, localePages);
    }
    return localePages;
}

/** A route's prerender entries, in every served locale. */
export function entriesOf<Params extends Record<string, string>>(
    of: (localePages: Pages) => Promise<Params[]>,
): Promise<(Params & { locale?: string })[]> {
    return inEveryLocale(locale => of(pages(locale)));
}

/** Every indexed page's path, every served locale's in turn: one sitemap for the site. */
export async function sitemapPaths(): Promise<string[]> {
    return (await Promise.all(SERVED_LOCALES.map(locale => pages(locale).sitemapPaths()))).flat();
}

/**
 * One of the search index's two files, as its route writes it: stamped with the dataset version.
 * English's: a locale's own search index (its glosses) comes with the locale (#170).
 */
export async function searchIndexFile(part: 'core' | 'full'): Promise<SearchIndexFile> {
    return stampedSearchIndex((await pages(DEFAULT_LOCALE).searchIndex())[part]);
}

/**
 * A page in every served locale that has it, this one included, in LOCALES' order: its hreflang
 * alternates and its language switcher. Asked of each locale's own answer (a word page from its
 * text, a list page from its words), so two locales' pages name each other or neither: none when
 * no other locale has the page. A list page is asked at build only, where every page is built.
 */
export async function alternatesOf(key: PageKey, locale: ServedLocale): Promise<Alternate[]> {
    if (SERVED_LOCALES.length === 1) return [];
    const serving = await Promise.all(SERVED_LOCALES.map(async other => (
        other === locale || (key.type === 'vocab' ? await entityPages(other).servesWord(key.id) : await pages(other).servesPage(key))
    )));
    const found = SERVED_LOCALES.filter((_, at) => serving[at]);
    return found.length > 1 ? found.map(other => ({ locale: other, path: pathOf(key, other) })) : [];
}
