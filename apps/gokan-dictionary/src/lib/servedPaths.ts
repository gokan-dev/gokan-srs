// How CloudFront tells the dictionary's files from its pages, with no list of routes to drift
// from SvelteKit's: a path with a dot names a file (the hashed assets, the search index, the
// sitemap, the favicon), served from the bucket; a path without one names a page (every page is
// a directory, written as <path>/index.html), served by the dictionary's server
// (apps/gokan-srs/terraform, the /dictionary/*.* and /dictionary/* behaviors). Held by
// scripts/check-build.ts on every build, since a page with a dot would be asked of the bucket,
// and a file without one of the server.

/**
 * Whether CloudFront sends a path (relative to /dictionary/) to the bucket: a dot anywhere in it,
 * as its `/dictionary/*.*` behavior matches, a dotted directory included. Every other path is a
 * page, the server's. The one statement of the rule: the build's check and the local CloudFront
 * stand-in (scripts/lib/builtSite.ts) both route by it.
 */
export function isDictionaryFilePath(pathWithinBase: string): boolean {
    return pathWithinBase.includes('.');
}

/** The built paths (dist-relative) CloudFront would send to the wrong origin. */
export function misroutedPaths(files: readonly string[]): string[] {
    return files.filter(file => {
        // A page is served at its directory's path, never at its index.html.
        if (file.endsWith('/index.html') || file === 'index.html') return isDictionaryFilePath(file.slice(0, -'index.html'.length));
        return !isDictionaryFilePath(file);
    });
}
