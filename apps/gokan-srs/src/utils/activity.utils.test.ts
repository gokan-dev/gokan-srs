import { describe, it, expect } from 'vitest';
import { buildDailyActivity } from './activity.utils';
import type { ReviewLog, SRSEntry, VocabProgress } from '../models/vocabulary.model';
import type { UserProgress } from '../models/user.model';
import type { GrammarProgress } from '../models/grammar.model';
import { grammarProgress, reviewLog, srsEntry, userProgress, vocabProgress } from '../test/fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-06-10T12:00:00Z');

const makeLog = (overrides: Partial<ReviewLog> = {}): ReviewLog => reviewLog({ date: now.getTime(), ...overrides });

const makeEntry = (history: ReviewLog[] = []): SRSEntry => srsEntry({ history });

const makeVocab = (reading: ReviewLog[] = [], meaning: ReviewLog[] = []): VocabProgress =>
    vocabProgress({ totalReviews: 1, reading: makeEntry(reading), meaning: makeEntry(meaning), production: undefined });

const makeGrammar = (history: ReviewLog[] = []): GrammarProgress => grammarProgress({ grammarId: 'g1', totalReviews: 1, entry: makeEntry(history) });

const makeProgress = (learningQueue: VocabProgress[], grammarQueue: GrammarProgress[] = []): UserProgress =>
    userProgress({ kanjiKnowledge: { method: 'kklc', step: 1, kanjiSet: new Set() }, learningQueue, grammarQueue });

describe('buildDailyActivity', () => {
    it('returns `days` buckets ending today, all zeroed with no history', () => {
        const buckets = buildDailyActivity(makeProgress([]), 7, now);
        expect(buckets).toHaveLength(7);
        expect(buckets.every(b => b.correct === 0 && b.incorrect === 0)).toBe(true);
        expect(buckets[6].date.toDateString()).toBe(now.toDateString());
    });

    it('groups correct and minor_error as correct, wrong as incorrect, and excludes pass', () => {
        const vocab = makeVocab([
            makeLog({ result: 'correct' }),
            makeLog({ result: 'minor_error' }),
            makeLog({ result: 'wrong' }),
            makeLog({ result: 'pass' }),
        ]);
        const buckets = buildDailyActivity(makeProgress([vocab]), 1, now);
        expect(buckets[0].correct).toBe(2);
        expect(buckets[0].incorrect).toBe(1);
    });

    it('aggregates history from both reading and meaning entries', () => {
        const vocab = makeVocab([makeLog({ result: 'correct' })], [makeLog({ result: 'wrong' })]);
        const buckets = buildDailyActivity(makeProgress([vocab]), 1, now);
        expect(buckets[0].correct).toBe(1);
        expect(buckets[0].incorrect).toBe(1);
    });

    it('buckets a log by its calendar day, not exact timestamp', () => {
        const yesterday = new Date(now.getTime() - DAY_MS);
        const vocab = makeVocab([makeLog({ date: yesterday.getTime(), result: 'correct' })]);
        const buckets = buildDailyActivity(makeProgress([vocab]), 2, now);
        expect(buckets[0].correct).toBe(1);
        expect(buckets[1].correct).toBe(0);
    });

    it('drops a log that falls outside the requested window', () => {
        const longAgo = new Date(now.getTime() - 30 * DAY_MS);
        const vocab = makeVocab([makeLog({ date: longAgo.getTime(), result: 'correct' })]);
        const buckets = buildDailyActivity(makeProgress([vocab]), 7, now);
        expect(buckets.every(b => b.correct === 0)).toBe(true);
    });

    it('folds in grammar entry.history alongside vocab reading/meaning history', () => {
        const vocab = makeVocab([makeLog({ result: 'correct' })]);
        const grammar = makeGrammar([makeLog({ result: 'wrong' }), makeLog({ result: 'pass' })]);
        const buckets = buildDailyActivity(makeProgress([vocab], [grammar]), 1, now);
        expect(buckets[0].correct).toBe(1);
        expect(buckets[0].incorrect).toBe(1);
    });

    it('counts grammar-only activity when the learning queue is empty', () => {
        const grammar = makeGrammar([makeLog({ result: 'minor_error' })]);
        const buckets = buildDailyActivity(makeProgress([], [grammar]), 1, now);
        expect(buckets[0].correct).toBe(1);
        expect(buckets[0].incorrect).toBe(0);
    });
});
