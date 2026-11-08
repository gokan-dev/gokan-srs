import { describe, expect, it } from 'vitest';
import { isDictionaryFilePath, misroutedPaths } from './servedPaths';

describe('misroutedPaths', () => {
    it('accepts pages without a dot and files with one', () => {
        expect(misroutedPaths([
            'index.html',
            'vocab/1358280/index.html',
            'kanji/思/index.html',
            'grammar/n5-001/index.html',
            'assets/styles-BmsKx0B-.css',
            'data/search-core.json',
            'sitemap.xml',
            'favicon.svg',
        ])).toEqual([]);
    });

    it('names a page whose path has a dot, and a file whose name has none', () => {
        expect(misroutedPaths(['grammar/v1.2/index.html', 'CNAME', 'assets/LICENSE'])).toEqual(['grammar/v1.2/index.html', 'CNAME', 'assets/LICENSE']);
    });
});

describe('isDictionaryFilePath', () => {
    // CloudFront's /dictionary/*.* : `*` matches any characters, slashes included.
    const cloudFrontFile = (pathWithinBase: string) => /^.*\..*$/s.test(pathWithinBase);

    it('agrees with CloudFront on a page, a file and a dotted directory', () => {
        for (const path of ['vocab/1358280/', '', 'kanji/思/', 'assets/styles-BmsKx0B-.css', 'sitemap.xml', 'a.b/LICENSE']) {
            expect(isDictionaryFilePath(path), path).toBe(cloudFrontFile(path));
        }
        expect(isDictionaryFilePath('a.b/LICENSE')).toBe(true);
        expect(isDictionaryFilePath('vocab/1358280/')).toBe(false);
    });

    it('lets a file under a dotted directory reach the bucket', () => {
        expect(misroutedPaths(['a.b/LICENSE'])).toEqual([]);
    });
});
