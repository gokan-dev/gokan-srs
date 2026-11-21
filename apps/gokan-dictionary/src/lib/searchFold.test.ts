import { describe, expect, it } from 'vitest';
import { FOLD_VISIBLE, FOLD_WHOLE_UP_TO, foldRows } from './searchFold';

const rows = (count: number) => Array.from({ length: count }, (_, i) => i);

describe('foldRows', () => {
    it('lists a short section whole', () => {
        expect(foldRows(rows(FOLD_WHOLE_UP_TO))).toEqual({ shown: rows(8), hidden: [] });
    });

    it('folds a longer one past its first rows', () => {
        const folded = foldRows(rows(FOLD_WHOLE_UP_TO + 1));
        expect(folded.shown).toEqual(rows(FOLD_VISIBLE));
        expect(folded.hidden).toEqual([5, 6, 7, 8]);
    });

    it('lists every row, however many, so the counts match what is listed', () => {
        const folded = foldRows(rows(60));
        expect(folded.shown.length + folded.hidden.length).toBe(60);
        expect([...folded.shown, ...folded.hidden]).toEqual(rows(60));
    });
});
