import { describe, expect, it } from 'vitest';
import {
    compareOutputs,
    contentChanged,
    countByKind,
    exampleCandidates,
    firstDifference,
    isIdentical,
    isTextOutput,
    outputKindOf,
    parityReport,
    parseParityArgs,
    servedPath,
    type Output,
    type ParityResult,
} from './parity';

/** An output whose content hashes equal its byte hashes unless `content` says otherwise. */
const output = (bytes: [string, string][], content: [string, string][] = []): Output => {
    const map = new Map(bytes);
    return { bytes: map, content: new Map([...map, ...content]) };
};

const result = (overrides: Partial<ParityResult>): ParityResult => ({ added: [], removed: [], changed: [], referenceOnly: [], compared: 40, ...overrides });

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
        expect(outputKindOf('sitemap-zh-hans.xml')).toBe('sitemap');
        expect(outputKindOf('assets/app-1a2b3c.css')).toBe('asset');
        expect(outputKindOf('.vite/manifest.json')).toBe('asset');
    });
});

describe('compareOutputs', () => {
    const base = output([['a.html', '1'], ['b.html', '2'], ['c.html', '3']]);

    it('finds nothing between equal outputs', () => {
        const same = compareOutputs(base, output([['a.html', '1'], ['b.html', '2'], ['c.html', '3']]));
        expect(isIdentical(same)).toBe(true);
        expect(same.compared).toBe(3);
    });

    it('sorts changed, added and removed files apart', () => {
        const head = output([['c.html', '3'], ['b.html', 'two'], ['d.html', '4']]);
        expect(compareOutputs(base, head)).toEqual({ added: ['d.html'], removed: ['a.html'], changed: ['b.html'], referenceOnly: [], compared: 2 });
    });

    it('tells a page whose only asset references changed from one whose content did', () => {
        const before = output([['a.html', '1'], ['b.html', '2']], [['a.html', 'page a'], ['b.html', 'page b']]);
        const after = output([['a.html', '1x'], ['b.html', '2x']], [['a.html', 'page a'], ['b.html', 'page b, edited']]);
        const compared = compareOutputs(before, after);
        expect(compared.changed).toEqual(['a.html', 'b.html']);
        expect(compared.referenceOnly).toEqual(['a.html']);
        expect(contentChanged(compared)).toEqual(['b.html']);
        expect(isIdentical(compared)).toBe(false);
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
        expect(exampleCandidates(result({ changed }), 3)).toEqual(['vocab/1/index.html', 'index.html', 'vocab/2/index.html']);
    });

    it('shows a content change before a reference-only one', () => {
        const changed = ['vocab/1/index.html', 'vocab/2/index.html'];
        expect(exampleCandidates(result({ changed, referenceOnly: ['vocab/1/index.html'] }), 1)).toEqual(['vocab/2/index.html']);
    });
});

describe('isTextOutput', () => {
    it('reads pages, data, styles, scripts and the icon as text', () => {
        for (const file of ['a/index.html', 'data/search-core.json', 'sitemap.xml', 'assets/app.css', 'assets/app.js', 'favicon.svg', 'robots.txt', 'site.webmanifest']) {
            expect(isTextOutput(file), file).toBe(true);
        }
    });

    it('does not read images or fonts as text', () => {
        expect(isTextOutput('icon.png')).toBe(false);
        expect(isTextOutput('assets/font-1a2b.woff2')).toBe(false);
    });
});

describe('parityReport', () => {
    it('says identical with the count', () => {
        expect(parityReport(result({}), 'main (abc)', [])).toBe(
            '**Pages identical** to main (abc): all 40 files, none added or removed.',
        );
    });

    it('lists counts by kind and the examples', () => {
        const report = parityReport(
            result({ added: ['vocab/9/index.html'], changed: ['index.html'] }),
            'main (abc)',
            [{ path: 'index.html', change: { kind: 'text', difference: { line: 1, before: 'old', after: 'new' } } }],
        );
        expect(report).toContain('1 changed, 1 added, 0 removed');
        expect(report).toContain('- content changed: 1 (1 list page)');
        expect(report).not.toContain('only hashed-asset references');
        expect(report).toContain('- added: 1 word');
        expect(report).toContain('- old\n+ new');
    });

    it('counts content changes and reference-only changes apart', () => {
        const report = parityReport(
            result({ changed: ['index.html', 'vocab/1/index.html', 'vocab/2/index.html'], referenceOnly: ['vocab/1/index.html', 'vocab/2/index.html'] }),
            'main (abc)',
            [],
        );
        expect(report).toContain('3 changed, 0 added, 0 removed');
        expect(report).toContain('- content changed: 1 (1 list page)');
        expect(report).toContain('- only hashed-asset references changed: 2 (2 word)');
    });

    it('shows a binary example by size, not as text', () => {
        const report = parityReport(result({ changed: ['icon.png'] }), 'main (abc)', [
            { path: 'icon.png', change: { kind: 'binary', beforeBytes: 120, afterBytes: 140 } },
        ]);
        expect(report).toContain('`icon.png`, binary, 120 bytes to 140 bytes.');
        expect(report).not.toContain('```diff');
    });
});

describe('parseParityArgs', () => {
    it('defaults to origin/main, a build and no expectation', () => {
        expect(parseParityArgs([])).toEqual({ base: 'origin/main', build: true, expectIdentical: false, againstServer: false });
    });

    it('reads every option', () => {
        expect(parseParityArgs(['--base', 'HEAD^1', '--no-build', '--expect', 'identical'])).toEqual({ base: 'HEAD^1', build: false, expectIdentical: true, againstServer: false });
    });

    it('rejects a missing value and a flag in place of one', () => {
        expect(parseParityArgs(['--base'])).toBeInstanceOf(Error);
        expect(parseParityArgs(['--base', '--no-build'])).toBeInstanceOf(Error);
        expect(parseParityArgs(['--expect'])).toBeInstanceOf(Error);
    });

    it('rejects an unknown argument and an unknown expectation', () => {
        expect(parseParityArgs(['--bsae', 'main'])).toBeInstanceOf(Error);
        expect(parseParityArgs(['--expect', 'similar'])).toBeInstanceOf(Error);
    });
});

describe('parseParityArgs --against-server', () => {
    it('compares with the server, with or without a build, never with a base', () => {
        expect(parseParityArgs(['--against-server', '--no-build', '--expect', 'identical'])).toEqual({ base: 'origin/main', build: false, expectIdentical: true, againstServer: true });
        expect(parseParityArgs(['--against-server', '--base', 'HEAD^1'])).toBeInstanceOf(Error);
    });
});

describe('parseParityArgs --against', () => {
    it('compares with a deployed origin, never with a base or the local server too', () => {
        expect(parseParityArgs(['--against', 'https://staging.gokan-srs.com', '--expect', 'identical'])).toEqual({
            base: 'origin/main', build: true, expectIdentical: true, againstServer: false, againstOrigin: 'https://staging.gokan-srs.com',
        });
        expect(parseParityArgs(['--against', 'https://staging.gokan-srs.com', '--base', 'main'])).toBeInstanceOf(Error);
        expect(parseParityArgs(['--against', 'https://staging.gokan-srs.com', '--against-server'])).toBeInstanceOf(Error);
    });

    it('takes an origin, not a URL with a path', () => {
        expect(parseParityArgs(['--against', 'https://staging.gokan-srs.com/dictionary/'])).toBeInstanceOf(Error);
        expect(parseParityArgs(['--against', 'staging.gokan-srs.com'])).toBeInstanceOf(Error);
    });
});

describe('servedPath', () => {
    it('serves a page at its directory, with the slash, and a file at its own path', () => {
        expect(servedPath('/dictionary', 'index.html')).toBe('/dictionary/');
        expect(servedPath('/dictionary', 'vocab/1358280/index.html')).toBe('/dictionary/vocab/1358280/');
        expect(servedPath('/dictionary', 'data/search-core.json')).toBe('/dictionary/data/search-core.json');
        expect(servedPath('', 'grammar/n5-001/index.html')).toBe('/grammar/n5-001/');
    });

    it('percent-encodes a kanji as a browser requests it', () => {
        expect(servedPath('/dictionary', 'kanji/学/index.html')).toBe('/dictionary/kanji/%E5%AD%A6/');
    });
});
