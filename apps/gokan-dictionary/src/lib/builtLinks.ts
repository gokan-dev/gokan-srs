// The links a built page holds that lead nowhere, and hreflang alternates that do not answer each
// other: scripts/check-build.ts runs them over every page a locale other than English has (#226,
// #227), whose links go to its own pages only where they are served (lib/localeLinks.ts), and over
// every page that lists alternates. Pure: the build's files are asked through `exists` and `read`.

/** The built file a site path names (relative to dist/): a page's path is its directory's index.html; a query or a fragment is not part of it. */
function builtFileOf(sitePath: string, basePath: string): string {
    const relative = decodeURIComponent(sitePath.slice(basePath.length + 1).replace(/[?#].*$/, ''));
    return relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative;
}

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
        if (!exists(builtFileOf(href, basePath))) broken.add(href);
    }
    return [...broken];
}

/** A page's hreflang alternates, as its head lists them: hreflang -> absolute URL. */
export function alternatesIn(html: string): Map<string, string> {
    const alternates = new Map<string, string>();
    for (const [whole] of html.matchAll(/<link rel="alternate"[^>]*>/g)) {
        const hreflang = /\shreflang="([^"]*)"/.exec(whole)?.[1];
        const href = /\shref="([^"]*)"/.exec(whole)?.[1];
        if (hreflang !== undefined && href !== undefined) alternates.set(hreflang, href.replace(/&amp;/g, '&'));
    }
    return alternates;
}

const sameAlternates = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>) =>
    a.size === b.size && [...a].every(([hreflang, href]) => b.get(hreflang) === href);

/**
 * What is wrong with the alternates of the built page at `file` (relative to dist/): it lists
 * itself, every page it lists exists and lists the same alternates back (reciprocal, so each
 * language's page names every other), and x-default names one of them. `read` gives a built file's
 * HTML, or null when there is none; `siteOrigin` and `basePath` turn a listed URL into a file.
 */
export function alternateProblems(file: string, read: (builtPath: string) => string | null, siteOrigin: string, basePath: string): string[] {
    const html = read(file);
    if (html === null) return [`${file} is not built`];
    const alternates = alternatesIn(html);
    if (alternates.size === 0) return [];
    const fileOf = (url: string) => (url.startsWith(`${siteOrigin}${basePath}/`) ? builtFileOf(url.slice(siteOrigin.length), basePath) : null);
    const problems: string[] = [];
    const listed = [...alternates].filter(([hreflang]) => hreflang !== 'x-default');
    if (!listed.some(([, url]) => fileOf(url) === file)) problems.push(`${file} does not list itself among its alternates`);
    const xDefault = alternates.get('x-default');
    if (xDefault !== undefined && !listed.some(([, url]) => url === xDefault)) problems.push(`${file}'s x-default ${xDefault} is none of its alternates`);
    for (const [hreflang, url] of listed) {
        const other = fileOf(url);
        const otherHtml = other === null ? null : read(other);
        if (otherHtml === null) problems.push(`${file} lists ${hreflang} ${url}, which is not built`);
        else if (!sameAlternates(alternatesIn(otherHtml), alternates)) problems.push(`${file} lists ${hreflang} ${url}, which does not list the same alternates back`);
    }
    return problems;
}
