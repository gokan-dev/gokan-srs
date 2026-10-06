import { describe, expect, it } from 'vitest';
import { commonSortOptions, type ListedProgress } from './smartList.utils';

interface Item extends ListedProgress {
    failures: number;
}

const item = (overrides: Partial<Item> = {}): Item => ({
    stage: 'learning',
    introductionAt: new Date('2026-01-02T00:00:00Z'),
    nextReviewAt: new Date('2026-02-01T00:00:00Z'),
    failures: 0,
    ...overrides,
});

describe('commonSortOptions', () => {
    const options = commonSortOptions<Item, never>(p => p.failures);
    const keyOf = (value: string, p: Item) => {
        const option = options.find(o => o.value === value);
        if (!option) throw new Error(`no option ${value}`);
        return option.sortKey(p, undefined);
    };

    it('sorts by introduction date, unintroduced first', () => {
        expect(keyOf('added_date', item())).toBe(new Date('2026-01-02T00:00:00Z').getTime());
        expect(keyOf('added_date', item({ introductionAt: null }))).toBe(0);
    });

    it('puts items with no next review last', () => {
        expect(keyOf('next_review', item({ nextReviewAt: null }))).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('ranks graduated after learning, and failures by the supplied count', () => {
        expect(keyOf('srs_stage', item({ stage: 'graduated' }))).toBeGreaterThan(keyOf('srs_stage', item()));
        expect(keyOf('failures', item({ failures: 4 }))).toBe(4);
    });
});
