// Pure URL-building helpers, shared by the prerender script (to build hrefs, canonicals and
// sitemap entries) and the page components (to link between pages). Keeping this as the single
// source of truth means every generated link agrees on BASE_PATH.
//
// Note these are URL paths, NOT on-disk paths: prerender.ts writes pages under dist/ WITHOUT
// the base-path prefix, because the deploy step supplies that prefix as the S3 key prefix it
// syncs into. See site.ts's BASE_PATH comment.

import { BASE_PATH, SITE_ORIGIN } from './site';

export function homePath(): string {
    return `${BASE_PATH}/`;
}

export function vocabIndexPath(): string {
    return `${BASE_PATH}/vocab/`;
}

/**
 * One page of a JLPT level's vocabulary list: "/dictionary/vocab/jlpt-n1/" for the first page,
 * "/dictionary/vocab/jlpt-n1/2/" for the next ones.
 */
export function vocabJlptPath(level: number, page = 1): string {
    return `${BASE_PATH}/vocab/jlpt-n${level}/${page > 1 ? `${page}/` : ''}`;
}

export function kanjiIndexPath(): string {
    return `${BASE_PATH}/kanji/`;
}

export function vocabPath(id: string): string {
    return `${BASE_PATH}/vocab/${id}/`;
}

export function kanjiPath(character: string): string {
    return `${BASE_PATH}/kanji/${encodeURIComponent(character)}/`;
}

export function grammarIndexPath(): string {
    return `${BASE_PATH}/grammar/`;
}

export function grammarPath(id: string): string {
    return `${BASE_PATH}/grammar/${id}/`;
}

/** The curriculum index (issue #58): every chapter of the authored teaching order. */
export function grammarChaptersIndexPath(): string {
    return `${BASE_PATH}/grammar/chapters/`;
}

export function grammarChapterPath(id: string): string {
    return `${BASE_PATH}/grammar/chapters/${id}/`;
}

/** One near-synonym family's page: its members, plus any authored "when to use each" lessons. */
export function grammarFamilyPath(id: string): string {
    return `${BASE_PATH}/grammar/family/${id}/`;
}

/** Every near-synonym family with its members, linking to each family's page. */
export function grammarFamiliesIndexPath(): string {
    return `${BASE_PATH}/grammar/families/`;
}

/** The conjugation reference index: every inflection form, grouped, linking to each point's own table. */
export function grammarConjugationsIndexPath(): string {
    return `${BASE_PATH}/grammar/conjugations/`;
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

/** The full search results page; `query` goes in its `q` parameter. Not indexed, not in the sitemap. */
export function searchPath(query?: string): string {
    return `${BASE_PATH}/search/${query ? `?q=${encodeURIComponent(query)}` : ''}`;
}

/**
 * Hrefs the client search fetches its prebuilt index from: the core file first, the full one in
 * the background (see SearchIndexFile). Fixed paths, like the pages: the deploy is content
 * addressed, so a changed index is uploaded and served fresh without a hash in its name.
 */
export function searchIndexPaths(): { core: string; full: string } {
    return { core: `${BASE_PATH}/data/search-core.json`, full: `${BASE_PATH}/data/search-full.json` };
}

export function absoluteUrl(pathname: string): string {
    // Resolved against the bare origin, not the site URL: pathname already carries BASE_PATH, and
    // resolving an absolute path against a base with a path would be a silent no-op that only
    // shows up as a wrong canonical.
    return new URL(pathname, SITE_ORIGIN).toString();
}
