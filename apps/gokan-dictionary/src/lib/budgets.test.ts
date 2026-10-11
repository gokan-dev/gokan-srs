import { describe as group, expect, it } from 'vitest';
import { BUDGETS, describe, overBudget, percentile } from './budgets';

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
    it('keeps only the measurements over their budget', () => {
        const fits = { budget: 'webFont' as const, subject: 'a.woff2', bytes: BUDGETS.webFont };
        const over = { budget: 'webFont' as const, subject: 'b.woff2', bytes: BUDGETS.webFont + 1 };
        expect(overBudget([fits, over])).toEqual([over]);
    });
});

group('describe', () => {
    it('reports the size against the budget', () => {
        expect(describe({ budget: 'searchScript', subject: 'search.js', bytes: 8300 })).toBe('searchScript: search.js 8.1 KB of 10 KB');
    });
});
