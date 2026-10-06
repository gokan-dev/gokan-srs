import { describe, it, expect } from 'vitest';
import {
    cacheControlFor,
    contentHash,
    diffManifests,
    isSite,
    manifestFromListing,
    objectKey,
    parseManifest,
    planUploads,
} from './deployManifest';

const stored = (manifest: Record<string, string>) => ({ source: 'manifest' as const, manifest });

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

describe('parseManifest', () => {
    it('accepts a map of paths to hashes', () => {
        expect(parseManifest({ 'index.html': 'a' })).toEqual({ 'index.html': 'a' });
    });

    it('rejects anything else', () => {
        expect(parseManifest(null)).toBeNull();
        expect(parseManifest(['index.html'])).toBeNull();
        expect(parseManifest({ 'index.html': 1 })).toBeNull();
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

    it('builds keys with and without a prefix', () => {
        expect(objectKey('dictionary', 'index.html')).toBe('dictionary/index.html');
        expect(objectKey('', 'index.html')).toBe('index.html');
    });
});
