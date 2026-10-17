// Pure sitemap.xml / robots.txt builders. ~39k URLs total (vocab + kanji + grammar + home)
// fits comfortably under the 50,000-URL single-sitemap limit, so there's no sitemap index.
//
// No <lastmod> here: the build must stay byte-reproducible, and a build date would be the wrong
// date anyway. The deploy adds each URL's, the day its page's content last changed, from the
// deploy manifest (datedSitemap in packages/deploy/src/deployManifest.ts).

import { absoluteUrl, homePath } from './urls';
import { BASE_PATH } from './site';

/** Site-relative path the generated sitemap is served at. */
export function sitemapPath(): string {
    return `${BASE_PATH}/sitemap.xml`;
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
Allow: ${homePath()}

Sitemap: ${absoluteUrl(sitemapPath())}
`;
}
