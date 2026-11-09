// What a deploy clears from CloudFront: only the URLs whose response changed (#199).
//
// Invalidation paths are billed per path past the account's 1,000 free a month, shared by every
// distribution (CloudFront's flat-rate plans do not cover them, and the Free plan has no cache
// tags), so a deploy lists what changed rather than clearing a site by its wildcard, and falls back
// to the wildcard (one path) when the list would be long. A deploy that changes nothing a visitor
// of a site can get clears nothing of it: an app-only deploy keeps every cached dictionary page.

import { SITES, cacheControlFor, type BuildManifest, type Site } from './deployManifest';

/**
 * Most paths one deploy lists for the dictionary before clearing it by `/dictionary/*`: the
 * monthly budget left after staging and the app (about 785 of the 1,000 free paths) over about 40
 * production deploys a month. Past the free paths each costs $0.005, so this bounds a cost, not a
 * risk: a deploy over it re-renders on demand whatever is asked for again.
 */
export const DICTIONARY_PATH_CAP = 20;

interface InvalidationRule {
    /** The one path clearing the whole site, or null when its changed files are always listed. */
    wildcard: string | null;
    /** Most files listed before the wildcard is used instead. */
    cap: number;
}

const RULES: Record<Site, InvalidationRule> = {
    // The app's changing files are few (its shell, version.json, changelog.json, the manifest and
    // icons): listed whatever their number, since `/*` would clear the dictionary with them.
    srs: { wildcard: null, cap: Number.POSITIVE_INFINITY },
    dictionary: { wildcard: '/dictionary/*', cap: DICTIONARY_PATH_CAP },
    // A dataset release changes thousands of files under names it keeps, and CloudFront's key
    // ignores the version query its readers add: any change clears the whole prefix.
    data: { wildcard: '/dataset/*', cap: 0 },
};

/**
 * The URL CloudFront caches a built file under. The app's routes all reach its shell through the
 * SPA fallback function, which rewrites the URI to /index.html before the cache is looked up, so
 * its shell is cached once, as /index.html (`/` is not a key of its own). A dictionary page is its
 * directory, as the server answers it (`vocab/1/index.html` is `/dictionary/vocab/1/`).
 */
export function cachedUrl(site: Site, file: string): string {
    const base = SITES[site].prefix ? `/${SITES[site].prefix}/` : '/';
    if (site !== 'srs' && (file === 'index.html' || file.endsWith('/index.html'))) {
        return base + file.slice(0, -'index.html'.length);
    }
    return base + file;
}

export interface Invalidation {
    /** The paths to clear, sorted; empty when nothing a visitor can get changed. */
    paths: string[];
    /** How many files (pages included) changed, before any wildcard. */
    changedFiles: number;
}

/**
 * What to clear after a deploy, from what a visitor could get before it and can get now: every
 * file of the site by its byte hash, the bucket's and, on request, the pages its server renders
 * (identical to the static build's, `check:parity`). A file changed, added or removed is cleared,
 * unless it is content-hashed (immutable: a change is a new name). `previous` is null when the
 * last deploy is unknown (no stored manifest): the site is cleared whole, or, for the app, every
 * changing file is listed.
 */
export function invalidationFor(site: Site, previous: BuildManifest | null, current: BuildManifest): Invalidation {
    const rule = RULES[site];
    const changing = (file: string) => !cacheControlFor(site, file).includes('immutable');

    if (previous === null) {
        const files = Object.keys(current).filter(changing);
        if (rule.wildcard !== null) return { paths: [rule.wildcard], changedFiles: files.length };
        return { paths: [...new Set(files.map(file => cachedUrl(site, file)))].sort(), changedFiles: files.length };
    }

    const changed = new Set<string>();
    for (const [file, hash] of Object.entries(current)) {
        if (previous[file] !== hash && changing(file)) changed.add(file);
    }
    for (const file of Object.keys(previous)) {
        if (!(file in current) && changing(file)) changed.add(file);
    }

    if (changed.size === 0) return { paths: [], changedFiles: 0 };
    if (rule.wildcard !== null && changed.size > rule.cap) return { paths: [rule.wildcard], changedFiles: changed.size };
    return { paths: [...new Set([...changed].map(file => cachedUrl(site, file)))].sort(), changedFiles: changed.size };
}
