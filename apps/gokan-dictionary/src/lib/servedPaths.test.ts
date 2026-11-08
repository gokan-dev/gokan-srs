import { describe, expect, it } from 'vitest';
import { misroutedPaths } from './servedPaths';

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
