import { describe, it, expect } from 'vitest';
import { DICTIONARY_PATH_CAP, cachedUrl, invalidationFor } from './invalidation';

/** `count` dictionary pages, each its own hash; `salt` changes every one of them. */
const pages = (count: number, salt = 'a'): Record<string, string> =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`vocab/${i}/index.html`, `${salt}${i}`]));

describe('cachedUrl', () => {
    it('names a dictionary page by its directory, as the server answers it', () => {
        expect(cachedUrl('dictionary', 'vocab/1358280/index.html')).toBe('/dictionary/vocab/1358280/');
        expect(cachedUrl('dictionary', 'index.html')).toBe('/dictionary/');
        expect(cachedUrl('dictionary', 'data/search-core.json')).toBe('/dictionary/data/search-core.json');
    });

    it('names the app shell /index.html, the key every app route is cached under', () => {
        expect(cachedUrl('srs', 'index.html')).toBe('/index.html');
        expect(cachedUrl('srs', 'version.json')).toBe('/version.json');
    });

    it('names a dataset file under its prefix', () => {
        expect(cachedUrl('data', 'vocab/1.json')).toBe('/dataset/vocab/1.json');
    });
});

describe('invalidationFor', () => {
    it('clears nothing when no file a visitor can get changed (an app-only deploy, for the dictionary)', () => {
        const files = { ...pages(3), 'data/search-core.json': 's', 'assets/app-1.css': 'c' };
        expect(invalidationFor('dictionary', files, { ...files })).toEqual({ paths: [], changedFiles: 0 });
    });

    it('lists a changed page, an added one and a removed one', () => {
        const before = { 'vocab/1/index.html': 'a', 'vocab/2/index.html': 'b' };
        const after = { 'vocab/1/index.html': 'A', 'vocab/3/index.html': 'c' };
        expect(invalidationFor('dictionary', before, after)).toEqual({
            paths: ['/dictionary/vocab/1/', '/dictionary/vocab/2/', '/dictionary/vocab/3/'],
            changedFiles: 3,
        });
    });

    it('never clears a content-hashed asset: a change is a new name', () => {
        const before = { 'assets/app-1.css': 'x', 'vocab/1/index.html': 'a' };
        const after = { 'assets/app-2.css': 'y', 'vocab/1/index.html': 'a' };
        expect(invalidationFor('dictionary', before, after).paths).toEqual([]);
    });

    it('clears a changed unhashed file: the search index the server checks against its dataset', () => {
        const before = { 'data/search-core.json': 'v1', 'sitemap.xml': 's' };
        const after = { 'data/search-core.json': 'v2', 'sitemap.xml': 's' };
        expect(invalidationFor('dictionary', before, after).paths).toEqual(['/dictionary/data/search-core.json']);
    });

    it('lists up to the cap, then clears the dictionary by its wildcard', () => {
        expect(invalidationFor('dictionary', pages(DICTIONARY_PATH_CAP), pages(DICTIONARY_PATH_CAP, 'b')).paths).toHaveLength(DICTIONARY_PATH_CAP);
        expect(invalidationFor('dictionary', pages(DICTIONARY_PATH_CAP + 1), pages(DICTIONARY_PATH_CAP + 1, 'b')))
            .toEqual({ paths: ['/dictionary/*'], changedFiles: DICTIONARY_PATH_CAP + 1 });
    });

    it('clears a site whole when the previous deploy is unknown', () => {
        expect(invalidationFor('dictionary', null, pages(2)).paths).toEqual(['/dictionary/*']);
        expect(invalidationFor('data', null, { 'vocab/1.json': 'a' }).paths).toEqual(['/dataset/*']);
    });

    it('lists every changing app file when the previous deploy is unknown, never /* (it would clear the dictionary)', () => {
        const files = { 'index.html': 'a', 'version.json': 'b', 'assets/index-1.js': 'c' };
        expect(invalidationFor('srs', null, files).paths).toEqual(['/index.html', '/version.json']);
    });

    it('clears the dataset by its wildcard on any change, and not at all without one', () => {
        expect(invalidationFor('data', { 'vocab/1.json': 'a' }, { 'vocab/1.json': 'b' }).paths).toEqual(['/dataset/*']);
        expect(invalidationFor('data', { 'vocab/1.json': 'a' }, { 'vocab/1.json': 'a' }).paths).toEqual([]);
    });

    it('lists the app\'s changed files: a release clears its shell, version.json and changelog.json', () => {
        const before = { 'index.html': 'a', 'version.json': 'v1', 'changelog.json': 'c1', 'favicon.svg': 'f' };
        const after = { 'index.html': 'b', 'version.json': 'v2', 'changelog.json': 'c2', 'favicon.svg': 'f' };
        expect(invalidationFor('srs', before, after).paths).toEqual(['/changelog.json', '/index.html', '/version.json']);
    });
});
