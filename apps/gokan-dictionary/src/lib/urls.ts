// Pure URL-building helpers, shared by the server (lib/server/pages.ts, to build hrefs, canonicals and
// sitemap entries) and the page components (to link between pages). Keeping this as the single
// source of truth means every generated link agrees on BASE_PATH and on the locale.
//
// A page's path is built for a locale (`localeUrls`): English's are the site's paths as they have
// always been, another locale's sit under its segment (/dictionary/zh-hans/vocab/123/), so a link
// cannot be written without saying which language it leads to. A page component takes its
// locale's from pages/pageLocale.ts.
//
// Note these are URL paths, NOT on-disk paths: the build writes pages under dist/ WITHOUT
// the base-path prefix, because the deploy step supplies that prefix as the S3 key prefix it
// syncs into. See site.ts's BASE_PATH comment.

import type { KanjiOrderId } from '@gokan/dataset-schema';
import { localePrefix, type Locale } from './locale';
import { BASE_PATH, SITE_ORIGIN } from './site';

/** Every page's path in one locale. */
export function localeUrls(locale: Locale) {
    const root = `${BASE_PATH}${localePrefix(locale)}`;
    const urls = {
        homePath(): string {
            return `${root}/`;
        },
        vocabIndexPath(): string {
            return `${root}/vocab/`;
        },
        /**
         * One page of a JLPT level's vocabulary list: "/dictionary/vocab/jlpt-n1/" for the first page,
         * "/dictionary/vocab/jlpt-n1/2/" for the next ones.
         */
        vocabJlptPath(level: number, page = 1): string {
            return `${root}/vocab/jlpt-n${level}/${page > 1 ? `${page}/` : ''}`;
        },
        kanjiIndexPath(): string {
            return `${root}/kanji/`;
        },
        vocabPath(id: string): string {
            return `${root}/vocab/${id}/`;
        },
        kanjiPath(character: string): string {
            return `${root}/kanji/${encodeURIComponent(character)}/`;
        },
        /** Every kanji learning order, linking to each order's page. */
        kanjiOrdersPath(): string {
            return `${root}/kanji/orders/`;
        },
        /** One order's page: its steps in ranges of 100 kanji. */
        kanjiOrderPath(order: KanjiOrderId): string {
            return `${root}/kanji/orders/${kanjiOrderSlug(order)}/`;
        },
        /** One range of an order's steps, and the words they unlock: "/dictionary/kanji/orders/kklc/1-100/". */
        kanjiRangePath(order: KanjiOrderId, range: { first: number; last: number }): string {
            return `${urls.kanjiOrderPath(order)}${kanjiRangeSlug(range)}/`;
        },
        /** One step on its range page: "/dictionary/kanji/orders/kklc/301-400/#step-340". */
        kanjiStepPath(order: KanjiOrderId, range: { first: number; last: number }, step: number): string {
            return `${urls.kanjiRangePath(order, range)}#${kanjiStepAnchor(step)}`;
        },
        grammarIndexPath(): string {
            return `${root}/grammar/`;
        },
        grammarPath(id: string): string {
            return `${root}/grammar/${id}/`;
        },
        /** The curriculum index (issue #58): every chapter of the authored teaching order. */
        grammarChaptersIndexPath(): string {
            return `${root}/grammar/chapters/`;
        },
        grammarChapterPath(id: string): string {
            return `${root}/grammar/chapters/${id}/`;
        },
        /** One near-synonym family's page: its members, plus any authored "when to use each" lessons. */
        grammarFamilyPath(id: string): string {
            return `${root}/grammar/family/${id}/`;
        },
        /** Every near-synonym family with its members, linking to each family's page. */
        grammarFamiliesIndexPath(): string {
            return `${root}/grammar/families/`;
        },
        /** The conjugation reference index: every inflection form, grouped, linking to each point's own table. */
        grammarConjugationsIndexPath(): string {
            return `${root}/grammar/conjugations/`;
        },
        /** The full search results page; `query` goes in its `q` parameter. Not indexed, not in the sitemap. */
        searchPath(query?: string): string {
            return `${root}/search/${query ? `?q=${encodeURIComponent(query)}` : ''}`;
        },
    };
    return urls;
}

export type LocaleUrls = ReturnType<typeof localeUrls>;

/** An order id as a URL segment: kebab case, as URLs are written ("kanjiInContext" -> "kanji-in-context"). */
export function kanjiOrderSlug(order: KanjiOrderId): string {
    return order.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** The segment naming a range of steps: "1-100", or "2201-2300". */
export function kanjiRangeSlug(range: { first: number; last: number }): string {
    return `${range.first}-${range.last}`;
}

/** The id of one step's section on its range page. */
export function kanjiStepAnchor(step: number): string {
    return `step-${step}`;
}

/**
 * Href for a build emitted asset, given its dist-relative file path (e.g. the
 * content-hashed "assets/styles-BMo4ay5S.css" from Vite's client manifest).
 */
export function assetPath(distRelativeFile: string): string {
    return `${BASE_PATH}/${distRelativeFile.replace(/^\//, '')}`;
}

/**
 * The site's favicon, served from this app's own public/ directory rather than borrowing
 * gokan-srs's /gokan.svg: that would resolve only while the two share an origin, and would
 * silently 404 the moment BASE_PATH is cleared for a subdomain deployment.
 */
export function faviconPath(): string {
    return `${BASE_PATH}/favicon.svg`;
}

/**
 * Hrefs the client search fetches a locale's prebuilt index from: the core file first, the full
 * one in the background (see SearchIndexFile). English's at /data/, another locale's under its
 * segment (/data/zh-hans/), beside the site's other files rather than among its pages. Fixed paths,
 * like the pages: the deploy is content addressed, so a changed index is uploaded under the same
 * name and served with a 1-hour TTL, never as immutable (cacheControlFor in @gokan/deploy).
 */
export function searchIndexPaths(locale: Locale): { core: string; full: string } {
    const root = `${BASE_PATH}/data${localePrefix(locale)}`;
    return { core: `${root}/search-core.json`, full: `${root}/search-full.json` };
}

export function absoluteUrl(pathname: string): string {
    // Resolved against the bare origin, not the site URL: pathname already carries BASE_PATH, and
    // resolving an absolute path against a base with a path would be a silent no-op that only
    // shows up as a wrong canonical.
    return new URL(pathname, SITE_ORIGIN).toString();
}
