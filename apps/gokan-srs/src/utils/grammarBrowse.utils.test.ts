import { describe, expect, it } from 'vitest';
import { matchesGrammarStatus, sortGrammarRows } from './grammarBrowse.utils';
import { grammarBrowseRow, grammarProgress, reviewLog, srsEntry } from '../test/fixtures';
import { CONSTANTS } from '../commons/constants';

const introductionAt = new Date('2026-01-01');
const rows = [
    grammarBrowseRow({ id: 'a', orderIndex: 2 }),
    grammarBrowseRow({ id: 'variant', orderIndex: null }),
    grammarBrowseRow({ id: 'b', orderIndex: 0 }),
    grammarBrowseRow({ id: 'c', orderIndex: 1 }),
];
const ids = (sorted: { id: string }[]) => sorted.map(r => r.id);

describe('sortGrammarRows', () => {
    it('keeps teaching order, with points outside the order last', () => {
        expect(ids(sortGrammarRows(rows, 'teaching', new Map()))).toEqual(['b', 'c', 'a', 'variant']);
    });

    it('puts the earliest review first and points not studied last', () => {
        const progress = new Map([
            ['a', grammarProgress({ grammarId: 'a', introductionAt, entry: srsEntry({ dueDate: new Date('2026-02-01') }) })],
            ['c', grammarProgress({ grammarId: 'c', introductionAt, entry: srsEntry({ dueDate: new Date('2026-03-01') }) })],
        ]);
        expect(ids(sortGrammarRows(rows, 'next_review', progress))).toEqual(['a', 'c', 'b', 'variant']);
    });

    it('puts the most mistakes and the most mastery first', () => {
        const progress = new Map([
            ['c', grammarProgress({ grammarId: 'c', introductionAt, entry: srsEntry({ history: [reviewLog({ result: 'wrong' }), reviewLog({ result: 'wrong' })] }) })],
            ['a', grammarProgress({ grammarId: 'a', introductionAt, entry: srsEntry({ memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength }) })],
        ]);
        expect(ids(sortGrammarRows(rows, 'mistakes', progress))[0]).toBe('c');
        expect(ids(sortGrammarRows(rows, 'mastery', progress))[0]).toBe('a');
    });
});

describe('matchesGrammarStatus', () => {
    it('matches New, Learning and Mastered by the point\'s status, and All always', () => {
        const learning = grammarProgress({ introductionAt });
        expect(matchesGrammarStatus(undefined, 'new')).toBe(true);
        expect(matchesGrammarStatus(learning, 'learning')).toBe(true);
        expect(matchesGrammarStatus(learning, 'mastered')).toBe(false);
        expect(matchesGrammarStatus(undefined, 'all')).toBe(true);
    });
});
