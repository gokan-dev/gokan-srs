import { describe, it, expect } from 'vitest';
import { isGrammarFullyMastered, grammarNextReviewAt, isGrammarDue, clearStaleGrammarNeedsRetry } from './grammarScheduling';
import { CONSTANTS } from '../commons/constants';
import type { SRSEntry } from '../models/vocabulary.model';
import type { GrammarProgress } from '../models/grammar.model';
import { grammarProgress, srsEntry } from '../test/fixtures';

const MAX = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

const makeEntry = (overrides: Partial<SRSEntry> = {}): SRSEntry => srsEntry({ memoryStrength: 10, interval: 5, ...overrides });

const makeGrammarProgress = (overrides: Partial<GrammarProgress> = {}): GrammarProgress =>
    grammarProgress({ introductionAt: new Date('2026-06-01T00:00:00Z'), totalReviews: 1, entry: makeEntry(), ...overrides });

describe('grammarScheduling', () => {
    describe('isGrammarFullyMastered', () => {
        it('is false below the mastery threshold', () => {
            expect(isGrammarFullyMastered({ entry: makeEntry({ memoryStrength: MAX - 1 }) })).toBe(false);
        });
        it('is true at or above the mastery threshold', () => {
            expect(isGrammarFullyMastered({ entry: makeEntry({ memoryStrength: MAX }) })).toBe(true);
        });
    });

    describe('grammarNextReviewAt', () => {
        it('returns the entry due date when not mastered', () => {
            const due = new Date('2026-06-05T00:00:00Z');
            expect(grammarNextReviewAt({ entry: makeEntry({ dueDate: due }) })).toEqual(due);
        });

        it('returns null once mastered, regardless of dueDate', () => {
            const due = new Date('2026-06-05T00:00:00Z');
            expect(grammarNextReviewAt({ entry: makeEntry({ memoryStrength: MAX, dueDate: due }) })).toBeNull();
        });
    });

    describe('isGrammarDue', () => {
        const now = new Date('2026-06-10T00:00:00Z');
        const past = new Date('2026-06-01T00:00:00Z');
        const future = new Date('2026-07-01T00:00:00Z');

        it('is false for graduated items regardless of due date', () => {
            expect(isGrammarDue({ stage: 'graduated', entry: makeEntry({ dueDate: past }) }, now)).toBe(false);
        });

        it('is true when due in the past', () => {
            expect(isGrammarDue({ stage: 'learning', entry: makeEntry({ dueDate: past }) }, now)).toBe(true);
        });

        it('is false when due in the future', () => {
            expect(isGrammarDue({ stage: 'learning', entry: makeEntry({ dueDate: future }) }, now)).toBe(false);
        });

        it('is false when there is no due date at all', () => {
            expect(isGrammarDue({ stage: 'learning', entry: makeEntry({ dueDate: null }) }, now)).toBe(false);
        });
    });

    describe('clearStaleGrammarNeedsRetry', () => {
        const now = new Date('2026-06-10T00:00:00Z');
        const past = new Date('2026-06-01T00:00:00Z');
        const future = new Date('2026-07-01T00:00:00Z');

        it('clears needsRetry when the point also has a regular due review (issue #36)', () => {
            const g = makeGrammarProgress({ needsRetry: true, entry: makeEntry({ dueDate: past }) });
            const [result] = clearStaleGrammarNeedsRetry([g], now);
            expect(result.needsRetry).toBe(false);
        });

        it('leaves needsRetry untouched when the regular review is not yet due (same-session retry)', () => {
            const g = makeGrammarProgress({ needsRetry: true, entry: makeEntry({ dueDate: future }) });
            const [result] = clearStaleGrammarNeedsRetry([g], now);
            expect(result.needsRetry).toBe(true);
        });

        it('leaves needsRetry untouched when there is no due date at all', () => {
            const g = makeGrammarProgress({ needsRetry: true, entry: makeEntry({ dueDate: null }) });
            const [result] = clearStaleGrammarNeedsRetry([g], now);
            expect(result.needsRetry).toBe(true);
        });

        it('is a no-op for items without needsRetry', () => {
            const g = makeGrammarProgress({ needsRetry: undefined, entry: makeEntry({ dueDate: past }) });
            const [result] = clearStaleGrammarNeedsRetry([g], now);
            expect(result.needsRetry).toBeUndefined();
        });

        it('returns the exact same array reference when nothing changed (avoids spurious progress updates)', () => {
            const queue = [makeGrammarProgress({ needsRetry: true, entry: makeEntry({ dueDate: future }) })];
            expect(clearStaleGrammarNeedsRetry(queue, now)).toBe(queue);
        });

        it('respects graduated stage - a graduated item is never "due" so its stale flag is left alone', () => {
            const g = makeGrammarProgress({ stage: 'graduated', needsRetry: true, entry: makeEntry({ dueDate: past }) });
            const [result] = clearStaleGrammarNeedsRetry([g], now);
            expect(result.needsRetry).toBe(true);
        });
    });
});
