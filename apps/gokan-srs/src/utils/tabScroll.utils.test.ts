import { describe, it, expect } from 'vitest';
import { NEIGHBOUR_SLICE, keepInViewMargin, tabRowScroll, type TabRow } from './tabScroll.utils';

// A studied 輝く's six tabs at 320px, as measured: Dict, Sentences, Synonyms, Kanji, Related, Study.
const PHONE_ROW: TabRow = {
    tabs: [[16, 42], [58, 129], [145, 216], [232, 265], [281, 331], [347, 386]].map(([left, right]) => ({ left, right })),
    width: 320,
    maxScroll: 82,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 16,
};

/**
 * Whether an edge with tabs past it cuts one by a slice on each side, as check:layout asserts.
 * A deliberate copy of the module's private predicate, not an import of it: a test that reused
 * the predicate under test would check nothing.
 */
function edgeCut(row: TabRow, at: number, edge: 'left' | 'right'): boolean {
    const x = edge === 'left' ? at : at + row.width;
    const hidden = row.tabs.some(tab => (edge === 'left' ? tab.left < x - 0.5 : tab.right > x + 0.5));
    return !hidden || row.tabs.some(tab => tab.left <= x - NEIGHBOUR_SLICE && tab.right >= x + NEIGHBOUR_SLICE);
}

describe('keepInViewMargin', () => {
    it('exceeds the padding plus the gap', () => {
        expect(keepInViewMargin(16, 16)).toBeGreaterThan(32);
    });
});

describe('tabRowScroll', () => {
    it('leaves a row alone when the open tab is in view and both edges cut a tab', () => {
        expect(tabRowScroll(PHONE_ROW, 2, 33)).toBe(33);
    });

    it('rests the first and last tabs at the row ends', () => {
        expect(tabRowScroll(PHONE_ROW, 0, 82)).toBe(0);
        expect(tabRowScroll(PHONE_ROW, 5, 0)).toBe(82);
    });

    it('never lands the next tab on the edge after a gap (Related from the start, Sentences from the end)', () => {
        // Aligned to the padding alone, Related ends at 304 and Study starts at the 320px edge.
        const related = tabRowScroll(PHONE_ROW, 4, 0);
        expect(edgeCut(PHONE_ROW, related, 'left') && edgeCut(PHONE_ROW, related, 'right')).toBe(true);
        const sentences = tabRowScroll(PHONE_ROW, 1, 82);
        expect(edgeCut(PHONE_ROW, sentences, 'left') && edgeCut(PHONE_ROW, sentences, 'right')).toBe(true);
    });

    it('shows the open tab inside the padding and cuts a tab at every edge, for every tab from either end', () => {
        for (const from of [0, PHONE_ROW.maxScroll]) {
            PHONE_ROW.tabs.forEach((tab, open) => {
                const at = tabRowScroll(PHONE_ROW, open, from);
                expect(at).toBeGreaterThanOrEqual(0);
                expect(at).toBeLessThanOrEqual(PHONE_ROW.maxScroll);
                expect(tab.left).toBeGreaterThanOrEqual(at + PHONE_ROW.paddingLeft);
                expect(tab.right).toBeLessThanOrEqual(at + PHONE_ROW.width - PHONE_ROW.paddingRight);
                expect(edgeCut(PHONE_ROW, at, 'left')).toBe(true);
                expect(edgeCut(PHONE_ROW, at, 'right')).toBe(true);
            });
        }
    });

    it('returns where it was for a tab it does not have', () => {
        expect(tabRowScroll(PHONE_ROW, 9, 12)).toBe(12);
    });
});
