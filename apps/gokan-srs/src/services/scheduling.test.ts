import { describe, it, expect } from 'vitest';
import { isEntryMastered, isMeaningQuizEnabled, isVocabFullyMastered, vocabNextReviewAt, isVocabDue } from './scheduling';
import { CONSTANTS } from '../commons/constants';
import type { SRSEntry, VocabProgress } from '../models/vocabulary.model';
import { srsEntry } from '../test/fixtures';

const MAX = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

const makeEntry = (overrides: Partial<SRSEntry> = {}): SRSEntry => srsEntry({ memoryStrength: 10, interval: 5, ...overrides });

describe('scheduling', () => {
    describe('isEntryMastered', () => {
        it('is false below the mastery threshold', () => {
            expect(isEntryMastered(makeEntry({ memoryStrength: MAX - 1 }))).toBe(false);
        });
        it('is true at or above the mastery threshold', () => {
            expect(isEntryMastered(makeEntry({ memoryStrength: MAX }))).toBe(true);
            expect(isEntryMastered(makeEntry({ memoryStrength: MAX + 10 }))).toBe(true);
        });
    });

    describe('isMeaningQuizEnabled', () => {
        it('defaults to true when settings are undefined', () => {
            expect(isMeaningQuizEnabled(undefined)).toBe(true);
        });
        it('is true unless explicitly false', () => {
            expect(isMeaningQuizEnabled({ enableMeaningQuiz: true })).toBe(true);
            expect(isMeaningQuizEnabled({ enableMeaningQuiz: false })).toBe(false);
        });
    });

    describe('vocabNextReviewAt', () => {
        const readingDue = new Date('2026-06-05T00:00:00Z');
        const meaningDue = new Date('2026-06-03T00:00:00Z');

        it('returns the earlier of reading/meaning due dates when both unmastered', () => {
            const vocab = {
                reading: makeEntry({ dueDate: readingDue }),
                meaning: makeEntry({ dueDate: meaningDue }),
            };
            expect(vocabNextReviewAt(vocab)).toEqual(meaningDue);
        });

        it('excludes meaning entirely when meaning quizzes are disabled, even if meaning is due sooner', () => {
            const vocab = {
                reading: makeEntry({ dueDate: readingDue }),
                meaning: makeEntry({ dueDate: meaningDue }),
            };
            expect(vocabNextReviewAt(vocab, { enableMeaningQuiz: false })).toEqual(readingDue);
        });

        it('excludes a mastered entry from the min calculation', () => {
            const vocab = {
                reading: makeEntry({ memoryStrength: MAX, dueDate: null }),
                meaning: makeEntry({ dueDate: meaningDue }),
            };
            expect(vocabNextReviewAt(vocab)).toEqual(meaningDue);
        });

        it('returns null when fully mastered (reading mastered, meaning disabled)', () => {
            const vocab = {
                reading: makeEntry({ memoryStrength: MAX, dueDate: null }),
                meaning: makeEntry({ memoryStrength: 1, dueDate: meaningDue }),
            };
            expect(vocabNextReviewAt(vocab, { enableMeaningQuiz: false })).toBeNull();
        });

        it('returns null when both reading and meaning are mastered', () => {
            const vocab = {
                reading: makeEntry({ memoryStrength: MAX, dueDate: null }),
                meaning: makeEntry({ memoryStrength: MAX, dueDate: null }),
            };
            expect(vocabNextReviewAt(vocab)).toBeNull();
        });
    });

    describe('isVocabFullyMastered', () => {
        it('requires both reading and meaning mastered when meaning quizzes are enabled', () => {
            const vocab = {
                reading: makeEntry({ memoryStrength: MAX }),
                meaning: makeEntry({ memoryStrength: 1 }),
            };
            expect(isVocabFullyMastered(vocab)).toBe(false);
            expect(isVocabFullyMastered(vocab, { enableMeaningQuiz: true })).toBe(false);
        });

        it('only requires reading mastered when meaning quizzes are disabled', () => {
            const vocab = {
                reading: makeEntry({ memoryStrength: MAX }),
                meaning: makeEntry({ memoryStrength: 1 }),
            };
            expect(isVocabFullyMastered(vocab, { enableMeaningQuiz: false })).toBe(true);
        });
    });

    describe('isVocabDue', () => {
        const now = new Date('2026-06-10T00:00:00Z');
        const past = new Date('2026-06-01T00:00:00Z');
        const future = new Date('2026-07-01T00:00:00Z');

        it('is false for graduated items regardless of due dates', () => {
            const vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'stage'> = {
                stage: 'graduated',
                reading: makeEntry({ dueDate: past }),
                meaning: makeEntry({ dueDate: past }),
            };
            expect(isVocabDue(vocab, undefined, now)).toBe(false);
        });

        it('is true when a non-mastered entry is due in the past', () => {
            const vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'stage'> = {
                stage: 'learning',
                reading: makeEntry({ dueDate: past }),
                meaning: makeEntry({ dueDate: future }),
            };
            expect(isVocabDue(vocab, undefined, now)).toBe(true);
        });

        it('is false when the only due entry is meaning but meaning quizzes are disabled', () => {
            const vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'stage'> = {
                stage: 'learning',
                reading: makeEntry({ memoryStrength: MAX, dueDate: null }),
                meaning: makeEntry({ dueDate: past }),
            };
            expect(isVocabDue(vocab, { enableMeaningQuiz: false }, now)).toBe(false);
        });
    });
});
