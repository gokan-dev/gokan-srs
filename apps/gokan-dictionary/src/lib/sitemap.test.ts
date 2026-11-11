import { describe, it, expect } from 'vitest';
import { buildSitemapIndexXml, buildSitemapXml, buildRobotsTxt, localeSitemapPath, shouldEmitRobotsTxt, SITEMAP_URL_LIMIT, sitemapPath, sitemapProblems } from './sitemap';
import { absoluteUrl, localeUrls } from './urls';
import { BASE_PATH } from './site';

const urls = localeUrls('en');

describe('buildSitemapXml', () => {
    it('wraps each path in a <url><loc> entry resolved to an absolute URL', () => {
        const xml = buildSitemapXml([urls.homePath(), urls.vocabPath('1589350')]);
        expect(xml).toContain(`<loc>${absoluteUrl(urls.homePath())}</loc>`);
        expect(xml).toContain(`<loc>${absoluteUrl(urls.vocabPath('1589350'))}</loc>`);
    });

    it('emits absolute URLs carrying the base path', () => {
        const xml = buildSitemapXml([urls.vocabPath('1589350')]);
        expect(xml).toContain(`${BASE_PATH}/vocab/1589350/`);
    });

    it('preserves percent-encoded segments without double-encoding', () => {
        const xml = buildSitemapXml([`${BASE_PATH}/kanji/%E6%80%9D/`]);
        expect(xml).toContain(`<loc>https://gokan-srs.com${BASE_PATH}/kanji/%E6%80%9D/</loc>`);
    });

    it('produces a valid urlset root element', () => {
        const xml = buildSitemapXml([urls.homePath()]);
        expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
        expect(xml.trim().endsWith('</urlset>')).toBe(true);
    });
});

describe('buildSitemapIndexXml', () => {
    it("lists each locale's sitemap, at the root beside the index, as an absolute URL", () => {
        const xml = buildSitemapIndexXml([localeSitemapPath('en'), localeSitemapPath('zh-hans')]);
        expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
        expect(xml).toContain(`<sitemap><loc>${absoluteUrl(`${BASE_PATH}/sitemap-en.xml`)}</loc></sitemap>`);
        expect(xml).toContain(`<sitemap><loc>${absoluteUrl(`${BASE_PATH}/sitemap-zh-hans.xml`)}</loc></sitemap>`);
        expect(xml.trim().endsWith('</sitemapindex>')).toBe(true);
    });
});

describe('sitemapProblems', () => {
    const sitemapOf = (count: number) => buildSitemapXml(Array.from({ length: count }, (_, i) => urls.vocabPath(String(i))));

    it('accepts a sitemap of up to 50,000 URLs, and refuses one over', () => {
        expect(sitemapProblems('sitemap-en.xml', sitemapOf(SITEMAP_URL_LIMIT))).toEqual([]);
        expect(sitemapProblems('sitemap.xml', sitemapOf(SITEMAP_URL_LIMIT + 1))).toEqual(['sitemap.xml lists 50,001 URLs, over the 50,000 a sitemap may hold']);
    });
});

describe('shouldEmitRobotsTxt', () => {
    it('is false in subfolder mode, because only the host root is ever fetched', () => {
        // Crawlers read robots.txt from the host root only, so /dictionary/robots.txt would be
        // dead bytes: gokan-srs's public/robots.txt owns this host and carries our Sitemap line.
        expect(BASE_PATH).not.toBe('');
        expect(shouldEmitRobotsTxt()).toBe(false);
    });
});

describe('buildRobotsTxt', () => {
    it('points at the sitemap under the base path', () => {
        const robots = buildRobotsTxt();
        expect(robots).toContain('User-agent: *');
        expect(robots).toContain(`Allow: ${urls.homePath()}`);
        expect(robots).toContain(`Sitemap: ${absoluteUrl(sitemapPath())}`);
    });
});
