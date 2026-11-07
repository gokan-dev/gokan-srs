import { describe, expect, it } from 'vitest';
import { compareOutputs, countByKind, exampleCandidates, firstDifference, isIdentical, outputKindOf, parityReport } from './parity';

describe('outputKindOf', () => {
    it('names entity pages', () => {
        expect(outputKindOf('vocab/1358280/index.html')).toBe('word');
        expect(outputKindOf('kanji/学/index.html')).toBe('kanji');
        expect(outputKindOf('grammar/n5-001/index.html')).toBe('grammar point');
    });

    it('names browse pages as list pages', () => {
        for (const page of [
            'index.html', 'search/index.html', 'vocab/index.html', 'vocab/jlpt-n5/index.html', 'vocab/jlpt-n1/2/index.html',
            'kanji/index.html', 'kanji/orders/index.html', 'kanji/orders/kklc/index.html', 'kanji/orders/kklc/1-100/index.html',
            'grammar/index.html', 'grammar/families/index.html', 'grammar/family/but/index.html', 'grammar/chapters/index.html',
            'grammar/chapters/n5-1/index.html', 'grammar/conjugations/index.html',
        ]) expect(outputKindOf(page), page).toBe('list page');
    });

    it('names the search index, the sitemap and assets', () => {
        expect(outputKindOf('data/search-core.json')).toBe('search index');
        expect(outputKindOf('data/search-full.json')).toBe('search index');
        expect(outputKindOf('sitemap.xml')).toBe('sitemap');
        expect(outputKindOf('assets/app-1a2b3c.css')).toBe('asset');
        expect(outputKindOf('.vite/manifest.json')).toBe('asset');
    });
});

describe('compareOutputs', () => {
    const base = new Map([['a.html', '1'], ['b.html', '2'], ['c.html', '3']]);

    it('finds nothing between equal outputs', () => {
        const result = compareOutputs(base, new Map(base));
        expect(isIdentical(result)).toBe(true);
        expect(result.compared).toBe(3);
    });

    it('sorts changed, added and removed files apart', () => {
        const head = new Map([['c.html', '3'], ['b.html', 'two'], ['d.html', '4']]);
        expect(compareOutputs(base, head)).toEqual({ added: ['d.html'], removed: ['a.html'], changed: ['b.html'], compared: 2 });
    });
});

describe('countByKind', () => {
    it('counts in a fixed order and leaves out empty kinds', () => {
        expect(countByKind(['sitemap.xml', 'vocab/1/index.html', 'vocab/2/index.html', 'index.html'])).toEqual([
            ['word', 2], ['list page', 1], ['sitemap', 1],
        ]);
    });
});

describe('firstDifference', () => {
    it('is undefined for equal texts', () => {
        expect(firstDifference('same', 'same')).toBeUndefined();
    });

    it('names the line and shows both sides around the difference', () => {
        const difference = firstDifference('<p>one</p>\n<p>dancing to the same beat</p>', '<p>one</p>\n<p>dancing to the same drum</p>');
        expect(difference?.line).toBe(2);
        expect(difference?.before).toContain('same beat');
        expect(difference?.after).toContain('same drum');
    });

    it('keeps a long single-line page readable', () => {
        const page = 'x'.repeat(5000);
        const difference = firstDifference(`${page}A${page}`, `${page}B${page}`);
        expect(difference?.before.length).toBeLessThan(130);
        expect(difference?.before.startsWith('…')).toBe(true);
        expect(difference?.before.endsWith('…')).toBe(true);
    });

    it('writes line breaks out, so CRLF against LF is visible', () => {
        const difference = firstDifference('<svg>\n<!-- a -->', '<svg>\r\n<!-- a -->');
        expect(difference?.before).toBe('<svg>\\n<!-- a -->');
        expect(difference?.after).toBe('<svg>\\r\\n<!-- a -->');
    });

    it('handles one text ending where the other goes on', () => {
        expect(firstDifference('abc', 'abcdef')?.after).toContain('def');
    });
});

describe('exampleCandidates', () => {
    it('shows one file of each kind before more of the same', () => {
        const changed = ['vocab/1/index.html', 'vocab/2/index.html', 'vocab/3/index.html', 'index.html'];
        expect(exampleCandidates(changed, 3)).toEqual(['vocab/1/index.html', 'index.html', 'vocab/2/index.html']);
    });
});

describe('parityReport', () => {
    it('says identical with the count', () => {
        expect(parityReport({ added: [], removed: [], changed: [], compared: 40 }, 'main (abc)', [])).toBe(
            '**Pages identical** to main (abc): all 40 files, none added or removed.',
        );
    });

    it('lists counts by kind and the examples', () => {
        const report = parityReport(
            { added: ['vocab/9/index.html'], removed: [], changed: ['index.html'], compared: 40 },
            'main (abc)',
            [{ path: 'index.html', difference: { line: 1, before: 'old', after: 'new' } }],
        );
        expect(report).toContain('1 changed, 1 added, 0 removed');
        expect(report).toContain('- changed: 1 list page');
        expect(report).toContain('- added: 1 word');
        expect(report).toContain('- old\n+ new');
    });
});
