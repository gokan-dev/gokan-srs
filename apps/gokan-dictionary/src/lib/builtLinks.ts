// The links a built page holds that lead nowhere: scripts/check-build.ts runs it over every page a
// locale other than English has (#226), whose links go to its own pages only where they are served
// (lib/localeLinks.ts). Pure: the build's files are asked through `exists`.

/**
 * The internal hrefs in `html` (under `basePath`, the site's base path) that name no built file,
 * each once. A page's path names its directory's index.html; a query or a fragment is not part of
 * the file. `exists` takes a path relative to the build's root (dist/).
 */
export function brokenLinks(html: string, basePath: string, exists: (builtPath: string) => boolean): string[] {
    const broken = new Set<string>();
    for (const [, raw] of html.matchAll(/\shref="([^"]*)"/g)) {
        const href = raw.replace(/&amp;/g, '&');
        if (!href.startsWith(`${basePath}/`) || href.startsWith('//')) continue;
        const pathname = href.slice(basePath.length + 1).replace(/[?#].*$/, '');
        const relative = decodeURIComponent(pathname);
        if (!exists(relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative)) broken.add(href);
    }
    return [...broken];
}
