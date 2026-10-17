// Pure logic behind the content-addressed deploy (see scripts/deploy-s3.ts), used for both sites
// in the bucket: gokan-srs at the root and gokan-dictionary under dictionary/.
//
// Why this exists: `aws s3 sync`'s default comparison uploads a file when the local mtime is
// newer than the S3 object's, and CI rebuilds from a fresh checkout every run, so every one of
// the dictionary's ~38k generated pages looked new on every deploy (~20 minutes each time).
//
// `--size-only` is NOT the fix, and this is the trap worth remembering. It skips any file whose
// byte length did not change, and both sites are full of edits that keep the length:
//  - asset filenames are content-hashed to a fixed length, so a CSS-only change produces page
//    HTML of identical length, and every page would keep pointing at a deleted stylesheet;
//  - a dataset edit often swaps one character for another. gokan-srs's data files were deployed
//    with `--size-only`, and a vocab entry whose `"jlptLevel":1` became `5` stayed N1 in
//    production. Comparing content hashes catches both by construction.

import crypto from 'node:crypto';

export type Site = 'srs' | 'dictionary';

export interface SiteConfig {
    /** Built output, relative to the repository root. */
    dist: string;
    /** Key prefix in the bucket, without slashes; '' for the bucket root. */
    prefix: string;
    /**
     * The file served for a URL with no file of its own (the SPA shell), or null when every URL
     * is its own file. Decides which file's date a sitemap URL carries (`datedSitemap`).
     */
    fallback: string | null;
}

export const SITES: Record<Site, SiteConfig> = {
    srs: { dist: 'apps/gokan-srs/dist', prefix: '', fallback: 'index.html' },
    dictionary: { dist: 'apps/gokan-dictionary/dist', prefix: 'dictionary', fallback: null },
};

export function isSite(value: string): value is Site {
    return Object.hasOwn(SITES, value);
}

/** The S3 key of a dist-relative file under a site's prefix. */
export function objectKey(prefix: string, file: string): string {
    return prefix ? `${prefix}/${file}` : file;
}

/** Map of dist-relative path (POSIX separators, no leading slash) to a content hash. */
export type BuildManifest = Record<string, string>;

/**
 * MD5, because it is what S3 reports as the ETag of an object uploaded in one part: a deploy
 * with no stored manifest can then compare against the bucket listing (`manifestFromListing`).
 */
export function contentHash(content: Uint8Array): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Map of dist-relative path to the UTC day (YYYY-MM-DD) its content hash last changed: the
 * sitemap's `<lastmod>`. Kept in the stored manifest, never in the build, which must stay
 * byte-reproducible.
 */
export type ChangeDates = Record<string, string>;

/** What a deploy stores beside the site: every file's hash and the day it last changed. */
export interface StoredManifest {
    hashes: BuildManifest;
    changed: ChangeDates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> | null {
    if (!isRecord(value)) return null;
    const out: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry !== 'string') return null;
        out[key] = entry;
    }
    return out;
}

/**
 * Narrows a manifest read back from S3; anything malformed counts as no manifest. A manifest
 * from before change dates were kept is a bare map of hashes: it reads with no dates, so its
 * files are dated by the deploy reading it.
 */
export function parseManifest(raw: unknown): StoredManifest | null {
    if (isRecord(raw) && 'hashes' in raw) {
        const hashes = stringRecord(raw.hashes);
        const changed = stringRecord(raw.changed);
        return hashes && changed ? { hashes, changed } : null;
    }
    const hashes = stringRecord(raw);
    return hashes ? { hashes, changed: {} } : null;
}

export function serializeManifest(manifest: StoredManifest): string {
    return JSON.stringify(manifest);
}

/**
 * Rebuilds what is deployed from a `list-objects-v2 --query "Contents[].[Key,ETag]"` listing,
 * for a deploy that has no stored manifest (the first one for a site, or after the manifest was
 * lost). A multipart upload's ETag is not an MD5 (it contains a '-'), so those files are left
 * out and get re-uploaded, which is the safe direction.
 */
export function manifestFromListing(listing: unknown, prefix: string): BuildManifest {
    const manifest: BuildManifest = {};
    if (!Array.isArray(listing)) return manifest;
    const keyPrefix = prefix ? `${prefix}/` : '';
    for (const entry of listing) {
        if (!Array.isArray(entry)) continue;
        const pair: unknown[] = entry;
        const [key, etag] = pair;
        if (typeof key !== 'string' || typeof etag !== 'string' || !key.startsWith(keyPrefix)) continue;
        const hash = etag.replaceAll('"', '');
        if (!/^[0-9a-f]{32}$/.test(hash)) continue;
        manifest[key.slice(keyPrefix.length)] = hash;
    }
    return manifest;
}

/**
 * What is currently deployed. Only a stored manifest may drive deletions: it lists exactly the
 * files this site uploaded. A bucket listing of the root also contains every other site's keys
 * (gokan-srs's root listing includes all of dictionary/), so pruning from it would delete them.
 */
export type PreviousDeploy =
    | { source: 'manifest'; manifest: BuildManifest; changed: ChangeDates }
    | { source: 'listing'; manifest: BuildManifest }
    | { source: 'none' };

export interface ManifestDiff {
    /** Files to upload: new, or whose content changed. */
    changed: string[];
    /** Keys present in the previous deploy but no longer built, to delete. */
    removed: string[];
    unchanged: number;
}

export function diffManifests(previous: PreviousDeploy, next: BuildManifest): ManifestDiff {
    // Nothing known about what is deployed: upload everything rather than risk a partial deploy.
    if (previous.source === 'none') {
        return { changed: Object.keys(next), removed: [], unchanged: 0 };
    }

    const changed: string[] = [];
    let unchanged = 0;
    for (const [file, hash] of Object.entries(next)) {
        if (previous.manifest[file] === hash) unchanged++;
        else changed.push(file);
    }

    const removed = previous.source === 'manifest'
        ? Object.keys(previous.manifest).filter(file => !(file in next))
        : [];

    return { changed, removed, unchanged };
}

/**
 * The day each file of `next` last changed: carried forward from the previous deploy while its
 * hash is the same, `today` when it differs or was never dated (a first deploy, a deploy from a
 * bucket listing, a manifest from before dates were kept). Google trusts `<lastmod>` only while
 * it stays accurate, so it is the day the content changed, never the build's.
 */
export function changeDates(previous: PreviousDeploy, next: BuildManifest, today: string): ChangeDates {
    const dates: ChangeDates = {};
    for (const [file, hash] of Object.entries(next)) {
        const carried = previous.source === 'manifest' && previous.manifest[file] === hash
            ? previous.changed[file]
            : undefined;
        dates[file] = carried ?? today;
    }
    return dates;
}

/** Where each site's sitemap is built, dist-relative. Built with no `<lastmod>`: the deploy dates it. */
export const SITEMAP_FILE = 'sitemap.xml';

/**
 * The dist file a sitemap URL is served from: a directory URL is its index.html, and a URL with
 * no file of its own is the site's fallback (gokan-srs's /about is the SPA shell). A URL that
 * resolves to nothing throws: a sitemap listing a page the build does not have is a build bug.
 */
export function sitemapUrlFile(site: Site, loc: string, files: ReadonlySet<string>): string {
    const { prefix, fallback } = SITES[site];
    const base = prefix ? `/${prefix}/` : '/';
    const pathname = decodeURIComponent(new URL(loc).pathname);
    if (pathname !== base.slice(0, -1) && !pathname.startsWith(base)) {
        throw new Error(`[deploy] sitemap URL ${loc} is outside ${base}`);
    }
    const relative = pathname.slice(base.length);
    const file = relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative;
    if (files.has(file)) return file;
    if (fallback !== null && files.has(fallback)) return fallback;
    throw new Error(`[deploy] sitemap URL ${loc} has no file in the build (${file})`);
}

/**
 * The built sitemap with each URL's `<lastmod>`: the day the file it is served from last changed.
 * A deploy with no content change therefore writes the same bytes, and the sitemap is not
 * re-uploaded. A built sitemap that already carries a `<lastmod>` throws: a date written by
 * hand or by the build is exactly the untrustworthy one this replaces.
 */
export function datedSitemap(site: Site, xml: string, changed: ChangeDates): string {
    if (xml.includes('<lastmod>')) throw new Error('[deploy] the built sitemap already carries <lastmod>');
    const files = new Set(Object.keys(changed));
    return xml.replaceAll(/<loc>([^<]*)<\/loc>/g, (match, loc: string) => {
        const date = changed[sitemapUrlFile(site, loc, files)];
        return `${match}<lastmod>${date}</lastmod>`;
    });
}

const REVALIDATE = 'public, max-age=0, must-revalidate';
const ONE_HOUR = 'public, max-age=3600';
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Cache-control for a dist-relative path. HTML always revalidates: it is the only thing that
 * knows which hashed asset filenames are current. Only content-hashed files are immutable.
 */
export function cacheControlFor(site: Site, file: string): string {
    if (file.endsWith('.html')) return REVALIDATE;
    switch (site) {
        case 'srs':
            // assets/ is Vite's hashed bundle. data/compiled/ keeps its file names across dataset
            // releases: the app adds the dataset version to every request (datasetUrl in
            // services/http.ts), so a new dataset is a new URL for the browser. The hour covers
            // the one gap the version cannot: CloudFront's cache key ignores the query string, so
            // a request for the new version made before the invalidation lands gets the old file.
            return file.startsWith('assets/') ? IMMUTABLE : ONE_HOUR;
        case 'dictionary':
            // The two unhashed files a reader or crawler must actually see change.
            if (file === 'data/search.json' || file === 'sitemap.xml') return ONE_HOUR;
            return IMMUTABLE;
    }
}

export interface UploadBatch {
    cacheControl: string;
    files: string[];
}

/**
 * The changed files grouped into one upload per cache-control header, HTML last. A page names
 * the hashed assets (and, in gokan-srs, the dataset version) it needs, so uploading it before
 * them would serve a page whose assets are not there yet.
 */
export function planUploads(site: Site, files: string[]): UploadBatch[] {
    const groups = new Map<string, string[]>();
    for (const file of files) {
        const header = cacheControlFor(site, file);
        const group = groups.get(header);
        if (group) group.push(file);
        else groups.set(header, [file]);
    }
    return [...groups]
        .map(([cacheControl, group]) => ({ cacheControl, files: group }))
        .sort((a, b) => Number(a.cacheControl === REVALIDATE) - Number(b.cacheControl === REVALIDATE));
}
