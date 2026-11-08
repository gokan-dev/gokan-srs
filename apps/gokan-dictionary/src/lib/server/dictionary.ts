// The dictionary's pages over their source: the one place a source of the dataset is chosen. While
// building, every page reads the checkout (dataset.server.ts's checkoutData). On request, an
// entity page reads the published dataset over HTTP (httpData), at the origin the server is given
// (DATASET_ORIGIN: CloudFront in production, a local server in the checks). Each locale's pages
// read the dataset's text in its language (datasetLanguageOf). Built on first use, so importing a
// route resolves no dataset.

import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { checkoutData, resolveCompiledDir } from '../dataset.server';
import { datasetLanguageOf, inEveryLocale, SERVED_LOCALES, type ServedLocale } from '../locale';
import { httpData } from './httpData';
import { entityPagesOf, pagesOf, type EntityPages, type Pages } from './pages';
import { publishedSourceUrls } from './rendering';

const built = new Map<ServedLocale, Pages>();
const onRequest = new Map<ServedLocale, EntityPages>();

/** Every page in one locale, over the checkout: what the build prerenders. */
export function pages(locale: ServedLocale): Pages {
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
