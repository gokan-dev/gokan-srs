// The dictionary's pages over their source: the one place a source of the dataset is chosen. While
// building, every page reads the checkout (dataset.server.ts's checkoutData, through the English
// view). On request, an entity page reads the published dataset over HTTP (httpData), at the
// origin the server is given (DATASET_ORIGIN: CloudFront in production, a local server in the
// checks). Built on first use, so importing a route resolves no dataset.

import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { checkoutData, resolveCompiledDir } from '../dataset.server';
import { httpData } from './httpData';
import { entityPagesOf, pagesOf, type EntityPages, type Pages } from './pages';
import { publishedSourceUrls } from './rendering';

let built: Pages | null = null;
let onRequest: EntityPages | null = null;

/** Every page, over the checkout: what the build prerenders. */
export function pages(): Pages {
    built ??= pagesOf(checkoutData(resolveCompiledDir()));
    return built;
}

/** A word, kanji or grammar point page: over the checkout while building, over HTTP on request. */
export function entityPages(): EntityPages {
    if (building) return pages();
    if (onRequest === null) {
        const origin = env.DATASET_ORIGIN;
        if (!origin) throw new Error('[dictionary] DATASET_ORIGIN is not set: the origin serving /dataset/ and the search index, e.g. https://gokan-srs.com.');
        onRequest = entityPagesOf(httpData(publishedSourceUrls(origin)));
    }
    return onRequest;
}
