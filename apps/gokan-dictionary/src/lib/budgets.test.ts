import { describe as group, expect, it } from 'vitest';
import { BUDGETS, countedBytes, describe, firstScreen, firstScreenBudgetOf, overBudget, PAGE_BUDGETS, percentile, type Measurement } from './budgets';

group('percentile', () => {
    it('takes the nearest rank', () => {
        const values = Array.from({ length: 10 }, (_, i) => i + 1);
        expect(percentile(values, 90)).toBe(9);
        expect(percentile(values, 50)).toBe(5);
        expect(percentile(values, 100)).toBe(10);
        expect(percentile([7], 90)).toBe(7);
        expect(percentile([], 90)).toBe(0);
    });

    it('does not depend on the input order', () => {
        expect(percentile([30, 10, 20], 50)).toBe(20);
    });
});

group('overBudget', () => {
    it('keeps only the measurements over their budget, counted as the budget says', () => {
        const limit = BUDGETS.wordPageP90.bytes;
        // Brotli counts: a page far over in raw bytes fits when its brotli does.
        const fits: Measurement = { budget: 'wordPageP90', subject: 'a', raw: limit * 5, brotli: limit };
        const over: Measurement = { budget: 'wordPageP90', subject: 'b', raw: limit, brotli: limit + 1 };
        expect(overBudget([fits, over])).toEqual([over]);
    });

    it('counts a woff2 raw: CloudFront sends it as it is', () => {
        const font: Measurement = { budget: 'webFont', subject: 'a.woff2', raw: BUDGETS.webFont.bytes + 1, brotli: BUDGETS.webFont.bytes };
        expect(countedBytes(font)).toBe(font.raw);
        expect(overBudget([font])).toEqual([font]);
    });
});

group('the 14 KB rule', () => {
    it('holds every page budget within the first round trip, less headers and margin', () => {
        // RFC 6928: an initial window of 10 segments, at most 14,600 bytes.
        // Every budget marked a page's, so one added later is held to it with no edit here.
        expect(PAGE_BUDGETS).toEqual(expect.arrayContaining(['wordPageP90', 'kanjiPageMax', 'grammarPageMax', 'homePage', 'grammarIndex', 'jlptPage', 'kanjiOrderPage', 'romajiPageMax']));
        for (const name of PAGE_BUDGETS) {
            expect(BUDGETS[name].encoding).toBe('brotli');
            expect(BUDGETS[name].bytes).toBeLessThanOrEqual(14_600 - 512);
        }
    });

    it('marks no file a page', () => {
        for (const name of ['blockingStylesheets', 'searchScript', 'searchCore', 'webFont'] as const) expect(PAGE_BUDGETS).not.toContain(name);
    });
});

group('firstScreen', () => {
    const page = '<head><li>not counted</li></head><main><h1>N5</h1><ul><li>a</li><li>b</li><li>c</li></ul></main><footer>f</footer>';

    it('ends at the given row inside main', () => {
        expect(firstScreen(page, 2)).toBe('<head><li>not counted</li></head><main><h1>N5</h1><ul><li>a</li><li>b</li>');
    });

    it('is the whole page when it has fewer rows', () => {
        expect(firstScreen(page, 3)).toBe('<head><li>not counted</li></head><main><h1>N5</h1><ul><li>a</li><li>b</li><li>c</li>');
        expect(firstScreen(page, 4)).toBe(page);
        expect(firstScreen('<p>no main</p>', 1)).toBe('<p>no main</p>');
    });
});

group('firstScreenBudgetOf', () => {
    it('names the list pages, in every locale', () => {
        expect(firstScreenBudgetOf('/grammar/')).toBe('grammarIndex');
        expect(firstScreenBudgetOf('/vocab/jlpt-n5/')).toBe('jlptPage');
        expect(firstScreenBudgetOf('/zh-hans/vocab/jlpt-n2/3/')).toBe('jlptPage');
        expect(firstScreenBudgetOf('/kanji/orders/')).toBe('kanjiOrderPage');
        expect(firstScreenBudgetOf('/kanji/orders/jlpt/301-400/')).toBe('kanjiOrderPage');
    });

    it('leaves the other pages whole', () => {
        for (const path of ['/', '/vocab/1000225/', '/grammar/n5-001/', '/kanji/一/', '/vocab/']) expect(firstScreenBudgetOf(path)).toBeNull();
    });
});

group('describe', () => {
    it('reports the counted size against the budget, raw beside brotli', () => {
        // The budget from BUDGETS, so a deliberate raise needs no second edit here.
        expect(describe({ budget: 'searchScript', subject: 'search.js', raw: 11 * 1024, brotli: 4300 })).toBe(`searchScript: search.js 4.2 KB brotli of ${BUDGETS.searchScript.bytes / 1024} KB (11 KB raw)`);
        expect(describe({ budget: 'webFont', subject: 'a.woff2', raw: 30 * 1024, brotli: 30 * 1024 })).toBe(`webFont: a.woff2 30 KB raw of ${BUDGETS.webFont.bytes / 1024} KB`);
    });
});
