import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { DICTIONARY_BASE_PATH } from '@gokan/dataset-schema';
import {
    cacheControlFor,
    changeDates,
    contentHash,
    datedSitemap,
    diffManifests,
    isSite,
    manifestFromListing,
    objectKey,
    pageContentHash,
    parseManifest,
    planUploads,
    serializeManifest,
    SITES,
    sitemapUrlFile,
    type PreviousDeploy,
} from './deployManifest';

/** A stored deploy; its content hashes default to its upload hashes (true of every non-page file). */
const stored = (manifest: Record<string, string>, changed: Record<string, string> = {}, content = manifest): PreviousDeploy =>
    ({ source: 'manifest', manifest, content, changed });

describe('diffManifests', () => {
    it('uploads only the files whose content hash changed', () => {
        const diff = diffManifests(
            stored({ 'index.html': 'a', 'vocab/1/index.html': 'b', 'vocab/2/index.html': 'c' }),
            { 'index.html': 'a', 'vocab/1/index.html': 'CHANGED', 'vocab/2/index.html': 'c' },
        );
        expect(diff.changed).toEqual(['vocab/1/index.html']);
        expect(diff.removed).toEqual([]);
        expect(diff.unchanged).toBe(2);
    });

    it('uploads files that are new since the last deploy', () => {
        const diff = diffManifests(stored({ 'index.html': 'a' }), { 'index.html': 'a', 'kanji/index.html': 'n' });
        expect(diff.changed).toEqual(['kanji/index.html']);
    });

    it('reports keys that no longer exist so they can be pruned', () => {
        const diff = diffManifests(stored({ 'index.html': 'a', 'vocab/9/index.html': 'x' }), { 'index.html': 'a' });
        expect(diff.removed).toEqual(['vocab/9/index.html']);
        expect(diff.changed).toEqual([]);
    });

    it('uploads everything when nothing is known about the deployed files', () => {
        const diff = diffManifests({ source: 'none' }, { 'index.html': 'a', 'kanji/index.html': 'b' });
        expect(diff.changed).toEqual(['index.html', 'kanji/index.html']);
        expect(diff.removed).toEqual([]);
        expect(diff.unchanged).toBe(0);
    });

    it('never prunes from a bucket listing', () => {
        // gokan-srs deploys to the bucket root, whose listing also holds every dictionary page.
        const listing = { source: 'listing' as const, manifest: { 'index.html': 'a', 'dictionary/index.html': 'd' } };
        const diff = diffManifests(listing, { 'index.html': 'a', 'data/compiled/kanji.json': 'k' });
        expect(diff.changed).toEqual(['data/compiled/kanji.json']);
        expect(diff.removed).toEqual([]);
        expect(diff.unchanged).toBe(1);
    });

    it('uploads nothing when the build is byte-identical', () => {
        const manifest = { 'index.html': 'a', 'vocab/1/index.html': 'b' };
        const diff = diffManifests(stored(manifest), { ...manifest });
        expect(diff.changed).toEqual([]);
        expect(diff.removed).toEqual([]);
        expect(diff.unchanged).toBe(2);
    });

    it('re-uploads every page when the stylesheet hash changes', () => {
        // The regression --size-only would have caused: hashed asset filenames are a fixed
        // length, so a page embedding a new stylesheet name has the same byte length as before.
        const previous = stored({ 'assets/styles-AAAAAAAA.css': 'v1', 'vocab/1/index.html': 'page-v1' });
        const next = { 'assets/styles-BBBBBBBB.css': 'v2', 'vocab/1/index.html': 'page-v2' };
        const diff = diffManifests(previous, next);
        expect(diff.changed).toContain('vocab/1/index.html');
        expect(diff.changed).toContain('assets/styles-BBBBBBBB.css');
        expect(diff.removed).toEqual(['assets/styles-AAAAAAAA.css']);
    });

    it('uploads a dataset file whose edit kept its byte length', () => {
        // The production incident: gokan-srs synced its data with --size-only, so this entry
        // moving from N1 to N5 was never uploaded.
        const before = new TextEncoder().encode('{"id":"1002120","jlptLevel":1}');
        const after = new TextEncoder().encode('{"id":"1002120","jlptLevel":5}');
        expect(after.length).toBe(before.length);
        const file = 'data/compiled/vocab/1002120.json';
        const diff = diffManifests(stored({ [file]: contentHash(before) }), { [file]: contentHash(after) });
        expect(diff.changed).toEqual([file]);
    });
});

describe('contentHash', () => {
    it('is the MD5 hex digest S3 reports as a single-part ETag', () => {
        expect(contentHash(new TextEncoder().encode('hello'))).toBe('5d41402abc4b2a76b9719d911017c592');
    });
});

describe('pageContentHash', () => {
    const page = (stylesheet: string, text: string) => new TextEncoder().encode(
        `<link rel="stylesheet" href="/dictionary/assets/${stylesheet}.css"><script type="module" src="/assets/${stylesheet}.js"></script><p>${text}</p>`,
    );

    it('ignores which hashed assets a page links', () => {
        expect(pageContentHash('vocab/1/index.html', page('app-AAAA', 'word')))
            .toBe(pageContentHash('vocab/1/index.html', page('app-BBBB', 'word')));
    });

    it('changes with what the page says', () => {
        expect(pageContentHash('vocab/1/index.html', page('app-AAAA', 'word')))
            .not.toBe(pageContentHash('vocab/1/index.html', page('app-AAAA', 'other')));
    });

    it('is the plain content hash for any file that is not a page', () => {
        const bytes = new TextEncoder().encode('"/assets/x.css"');
        expect(pageContentHash('data/search.json', bytes)).toBe(contentHash(bytes));
    });
});

describe('parseManifest', () => {
    it('reads back what a deploy stores', () => {
        const manifest = { hashes: { 'index.html': 'a' }, content: { 'index.html': 'c' }, changed: { 'index.html': '2026-10-12' } };
        expect(parseManifest(JSON.parse(serializeManifest(manifest)))).toEqual(manifest);
    });

    it('reads a manifest from before change dates as hashes with nothing to date by', () => {
        expect(parseManifest({ 'index.html': 'a' })).toEqual({ hashes: { 'index.html': 'a' }, content: {}, changed: {} });
    });

    it('reads a manifest from before content hashes with nothing to date by', () => {
        expect(parseManifest({ hashes: { 'index.html': 'a' }, changed: { 'index.html': '2026-10-12' } }))
            .toEqual({ hashes: { 'index.html': 'a' }, content: {}, changed: {} });
    });

    it('rejects anything else', () => {
        expect(parseManifest(null)).toBeNull();
        expect(parseManifest(['index.html'])).toBeNull();
        expect(parseManifest({ 'index.html': 1 })).toBeNull();
        expect(parseManifest({ hashes: { 'index.html': 'a' } })).toBeNull();
        expect(parseManifest({ hashes: { 'index.html': 'a' }, changed: { 'index.html': 1 } })).toBeNull();
        expect(parseManifest({ hashes: { 'index.html': 'a' }, content: [], changed: {} })).toBeNull();
    });
});

describe('changeDates', () => {
    const TODAY = '2026-10-17';

    it('carries the date forward while the hash is unchanged and dates today when it differs', () => {
        const previous = stored(
            { 'vocab/1/index.html': 'a', 'vocab/2/index.html': 'b' },
            { 'vocab/1/index.html': '2026-10-12', 'vocab/2/index.html': '2026-10-12' },
        );
        expect(changeDates(previous, { 'vocab/1/index.html': 'a', 'vocab/2/index.html': 'CHANGED', 'vocab/3/index.html': 'n' }, TODAY))
            .toEqual({ 'vocab/1/index.html': '2026-10-12', 'vocab/2/index.html': TODAY, 'vocab/3/index.html': TODAY });
    });

    it('keeps a page\'s date when only the hashed assets it links changed', () => {
        const before = new TextEncoder().encode('<link rel="stylesheet" href="/dictionary/assets/app-AAAA.css"><p>word</p>');
        const after = new TextEncoder().encode('<link rel="stylesheet" href="/dictionary/assets/app-BBBB.css"><p>word</p>');
        const file = 'vocab/1/index.html';
        const previous = stored({ [file]: contentHash(before) }, { [file]: '2026-10-12' }, { [file]: pageContentHash(file, before) });
        expect(contentHash(after)).not.toBe(contentHash(before));
        expect(changeDates(previous, { [file]: pageContentHash(file, after) }, TODAY)).toEqual({ [file]: '2026-10-12' });
    });

    it('dates everything today when nothing was dated before', () => {
        const next = { 'index.html': 'a' };
        expect(changeDates(stored({ 'index.html': 'a' }), next, TODAY)).toEqual({ 'index.html': TODAY });
        expect(changeDates({ source: 'listing', manifest: { 'index.html': 'a' } }, next, TODAY)).toEqual({ 'index.html': TODAY });
        expect(changeDates({ source: 'none' }, next, TODAY)).toEqual({ 'index.html': TODAY });
    });
});

describe('sitemapUrlFile', () => {
    const files = new Set(['index.html', 'vocab/1/index.html', 'kanji/学/index.html', 'robots.txt']);

    it('serves a dictionary directory URL from its index.html, decoded', () => {
        expect(sitemapUrlFile('dictionary', 'https://gokan-srs.com/dictionary/', files)).toBe('index.html');
        expect(sitemapUrlFile('dictionary', 'https://gokan-srs.com/dictionary/vocab/1/', files)).toBe('vocab/1/index.html');
        expect(sitemapUrlFile('dictionary', 'https://staging.gokan-srs.com/dictionary/kanji/%E5%AD%A6/', files)).toBe('kanji/学/index.html');
    });

    it('serves an app route with no file of its own from the SPA shell', () => {
        expect(sitemapUrlFile('srs', 'https://gokan-srs.com/', files)).toBe('index.html');
        expect(sitemapUrlFile('srs', 'https://gokan-srs.com/about', files)).toBe('index.html');
    });

    it('fails loudly on a dictionary URL the build has no page for', () => {
        expect(() => sitemapUrlFile('dictionary', 'https://gokan-srs.com/dictionary/vocab/9/', files)).toThrow(/no file/);
        expect(() => sitemapUrlFile('dictionary', 'https://gokan-srs.com/about', files)).toThrow(/outside/);
    });
});

describe('datedSitemap', () => {
    const built = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://gokan-srs.com/dictionary/</loc></url>
  <url><loc>https://gokan-srs.com/dictionary/vocab/1/</loc></url>
</urlset>
`;
    const hashes = { 'index.html': 'h', 'vocab/1/index.html': 'v', 'sitemap.xml': 's' };
    const deployedDates = { 'index.html': '2026-10-12', 'vocab/1/index.html': '2026-10-12', 'sitemap.xml': '2026-10-12' };
    const previous = stored(hashes, deployedDates);

    it('dates each URL by the day its page last changed', () => {
        const next = { ...hashes, 'vocab/1/index.html': 'CHANGED' };
        expect(datedSitemap('dictionary', built, changeDates(previous, next, '2026-10-17'))).toContain(
            '<url><loc>https://gokan-srs.com/dictionary/</loc><lastmod>2026-10-12</lastmod></url>\n'
            + '  <url><loc>https://gokan-srs.com/dictionary/vocab/1/</loc><lastmod>2026-10-17</lastmod></url>',
        );
    });

    it('writes the same sitemap when no content changed', () => {
        const before = datedSitemap('dictionary', built, deployedDates);
        const after = datedSitemap('dictionary', built, changeDates(previous, { ...hashes }, '2026-10-17'));
        expect(after).toBe(before);
        expect(after).not.toContain('2026-10-17');
    });

    it("dates gokan-srs's own sitemap, which is static and carries no dates", () => {
        const xml = fs.readFileSync(path.join(import.meta.dirname, '../../../apps/gokan-srs/public/sitemap.xml'), 'utf-8');
        const dated = datedSitemap('srs', xml, { 'index.html': '2026-10-17' });
        expect(dated.match(/<lastmod>2026-10-17<\/lastmod>/g)).toHaveLength(xml.match(/<loc>/g)?.length ?? -1);
    });

    it('refuses a built sitemap that already carries dates', () => {
        expect(() => datedSitemap('srs', '<url><loc>https://gokan-srs.com/</loc><lastmod>2026-03-10</lastmod></url>', { 'index.html': 'x' }))
            .toThrow(/lastmod/);
    });
});

describe('manifestFromListing', () => {
    it('maps keys under the prefix to their unquoted ETags', () => {
        const listing = [
            ['dictionary/index.html', '"5d41402abc4b2a76b9719d911017c592"'],
            ['index.html', '"7d793037a0760186574b0282f2f435e7"'],
        ];
        expect(manifestFromListing(listing, 'dictionary')).toEqual({ 'index.html': '5d41402abc4b2a76b9719d911017c592' });
    });

    it('keeps every key for the bucket root', () => {
        const listing = [['dictionary/index.html', '"5d41402abc4b2a76b9719d911017c592"']];
        expect(manifestFromListing(listing, '')).toEqual({ 'dictionary/index.html': '5d41402abc4b2a76b9719d911017c592' });
    });

    it('leaves out multipart ETags, which are not content hashes', () => {
        expect(manifestFromListing([['big.json', '"5d41402abc4b2a76b9719d911017c592-3"']], '')).toEqual({});
    });

    it('treats an empty bucket (the CLI prints null) as nothing deployed', () => {
        expect(manifestFromListing(null, '')).toEqual({});
    });
});

describe('cacheControlFor', () => {
    it('lets page HTML always revalidate', () => {
        expect(cacheControlFor('dictionary', 'vocab/1/index.html')).toBe('public, max-age=0, must-revalidate');
        expect(cacheControlFor('srs', 'index.html')).toBe('public, max-age=0, must-revalidate');
    });

    it('marks content-hashed assets immutable', () => {
        expect(cacheControlFor('dictionary', 'assets/styles-CPjhgttk.css')).toBe('public, max-age=31536000, immutable');
        expect(cacheControlFor('srs', 'assets/index-B2x9kQ1a.js')).toBe('public, max-age=31536000, immutable');
    });

    it('never marks a file that keeps its name across releases immutable', () => {
        expect(cacheControlFor('dictionary', 'data/search.json')).toBe('public, max-age=3600');
        expect(cacheControlFor('dictionary', 'sitemap.xml')).toBe('public, max-age=3600');
        expect(cacheControlFor('srs', 'data/compiled/vocab/1002120.json')).toBe('public, max-age=3600');
        expect(cacheControlFor('srs', 'manifest.json')).toBe('public, max-age=3600');
    });
});

describe('planUploads', () => {
    it('makes one batch per header and uploads HTML last', () => {
        const batches = planUploads('dictionary', ['index.html', 'vocab/1/index.html', 'assets/app.css', 'sitemap.xml']);
        expect(batches).toEqual([
            { cacheControl: 'public, max-age=31536000, immutable', files: ['assets/app.css'] },
            { cacheControl: 'public, max-age=3600', files: ['sitemap.xml'] },
            { cacheControl: 'public, max-age=0, must-revalidate', files: ['index.html', 'vocab/1/index.html'] },
        ]);
    });
});

describe('sites', () => {
    it('recognises only the configured sites', () => {
        expect(isSite('srs')).toBe(true);
        expect(isSite('dictionary')).toBe(true);
        expect(isSite('toString')).toBe(false);
    });

    it("uploads the dictionary under the path gokan-srs links it at", () => {
        expect(`/${SITES.dictionary.prefix}`).toBe(DICTIONARY_BASE_PATH);
    });

    it('builds keys with and without a prefix', () => {
        expect(objectKey('dictionary', 'index.html')).toBe('dictionary/index.html');
        expect(objectKey('', 'index.html')).toBe('index.html');
    });
});
