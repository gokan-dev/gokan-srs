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

/** Browse page for one JLPT level's vocabulary, e.g. "/dictionary/vocab/jlpt-n5/". */
export function vocabJlptPath(level: number): string {
    return `${BASE_PATH}/vocab/jlpt-n${level}/`;
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

/** Href the grammar browser fetches its prebuilt row data from. */
export function grammarBrowseDataPath(): string {
    return `${BASE_PATH}/data/grammar-browse.json`;
}

/** Href the client search script fetches its prebuilt index from. */
export function searchIndexPath(): string {
    return `${BASE_PATH}/data/search.json`;
}

export function absoluteUrl(pathname: string): string {
    // Resolved against the bare origin, not the site URL: pathname already carries BASE_PATH, and
    // resolving an absolute path against a base with a path would be a silent no-op that only
    // shows up as a wrong canonical.
    return new URL(pathname, SITE_ORIGIN).toString();
}
