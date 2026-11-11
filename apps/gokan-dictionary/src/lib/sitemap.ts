// Pure sitemap.xml / robots.txt builders. The site's sitemap is an index (sitemap.xml, the one URL
// robots.txt and Search Console name) of one sitemap per served locale (sitemap-en.xml,
// sitemap-zh-hans.xml): a sitemap holds at most 50,000 URLs (SITEMAP_URL_LIMIT), and English and
// Chinese together passed it (51,335 at 1.62.0, #170), which a search engine refuses whole.
// check-build holds every built sitemap under the limit.
//
// No <lastmod> here: the build must stay byte-reproducible, and a build date would be the wrong
// date anyway. The deploy adds each URL's, the day its page's content last changed, from the
// deploy manifest (datedSitemap in packages/deploy/src/deployManifest.ts), and each index entry's,
// the day its locale's sitemap last changed.

import { DEFAULT_LOCALE, type Locale } from './locale';
import { absoluteUrl, localeUrls } from './urls';
import { BASE_PATH } from './site';

/** The most URLs one sitemap may list (sitemaps.org); a larger one is refused, every URL in it. */
export const SITEMAP_URL_LIMIT = 50_000;

/** Site-relative path the sitemap index is served at: the one robots.txt names. */
export function sitemapPath(): string {
    return `${BASE_PATH}/sitemap.xml`;
}

/** Site-relative path of one locale's sitemap, at the site's root beside the index (a file: its name has a dot). */
export function localeSitemapPath(locale: Locale): string {
    return `${BASE_PATH}/sitemap-${locale}.xml`;
}

export function buildSitemapXml(paths: string[]): string {
    const urls = paths
        .map(path => `  <url><loc>${absoluteUrl(path)}</loc></url>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** The sitemap index: one entry per locale sitemap, by its site-relative path. */
export function buildSitemapIndexXml(sitemapPaths: string[]): string {
    const entries = sitemapPaths
        .map(path => `  <sitemap><loc>${absoluteUrl(path)}</loc></sitemap>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;
}

/** Why a search engine would refuse a built sitemap (`name`, for the report): more URLs than SITEMAP_URL_LIMIT. */
export function sitemapProblems(name: string, xml: string): string[] {
    const count = xml.match(/<loc>/g)?.length ?? 0;
    return count > SITEMAP_URL_LIMIT ? [`${name} lists ${count.toLocaleString('en')} URLs, over the ${SITEMAP_URL_LIMIT.toLocaleString('en')} a sitemap may hold`] : [];
}

/**
 * Whether this build should emit its own robots.txt.
 *
 * Crawlers only ever fetch robots.txt from the ROOT of a host: a file served at
 * /dictionary/robots.txt is never read by anything. So in subfolder mode (the default, see
 * site.ts) the authoritative robots.txt is gokan-srs's own, at apps/gokan-srs/public/robots.txt,
 * which is where this site's Sitemap: line lives. Emitting a second one here would be dead
 * bytes at best, and at worst something a future reader edits expecting it to take effect.
 *
 * Only a root-hosted deployment (BASE_PATH === '', i.e. a move to a dedicated subdomain) owns
 * its host's robots.txt and should generate one.
 */
export function shouldEmitRobotsTxt(): boolean {
    return BASE_PATH === '';
}

export function buildRobotsTxt(): string {
    return `User-agent: *
Allow: ${localeUrls(DEFAULT_LOCALE).homePath()}

Sitemap: ${absoluteUrl(sitemapPath())}
`;
}
