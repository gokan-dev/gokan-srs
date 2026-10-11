import { describe, expect, it } from 'vitest';
import { isVocabStruggling, matchesVocabStatus, vocabSortKey } from './vocabStatus.utils';
import { reviewLog, srsEntry, vocabProgress } from '../test/fixtures';

const now = new Date('2026-06-10T12:00:00Z');

describe('isVocabStruggling', () => {
    it('is false with fewer than 3 wrong results in the last 10', () => {
        const vocab = vocabProgress({
            reading: srsEntry({ history: [reviewLog({ result: 'wrong' }), reviewLog({ result: 'wrong' })] }),
        });
        expect(isVocabStruggling(vocab)).toBe(false);
    });

    it('is true with 3 or more wrong results merged across directions', () => {
        const vocab = vocabProgress({
            reading: srsEntry({ history: [reviewLog({ result: 'wrong', date: 3 })] }),
            meaning: srsEntry({ history: [reviewLog({ result: 'wrong', date: 2 })] }),
            production: srsEntry({ history: [reviewLog({ result: 'wrong', date: 1 })] }),
        });
        expect(isVocabStruggling(vocab)).toBe(true);
    });

    it('only looks at the last 10 reviews by date, not the whole history', () => {
        const oldWrongs = Array.from({ length: 5 }, (_, i) => reviewLog({ result: 'wrong', date: i }));
        const recentCorrects = Array.from({ length: 10 }, (_, i) => reviewLog({ result: 'correct', date: 100 + i }));
        const vocab = vocabProgress({ reading: srsEntry({ history: [...oldWrongs, ...recentCorrects] }) });
        expect(isVocabStruggling(vocab)).toBe(false);
    });
});

describe('matchesVocabStatus', () => {
    it('"all" matches everything', () => {
        expect(matchesVocabStatus(vocabProgress(), 'all', undefined, now)).toBe(true);
    });

    it('"mastered" and "learning" are opposites', () => {
        const mastered = vocabProgress({
            reading: srsEntry({ memoryStrength: 1000 }),
            meaning: srsEntry({ memoryStrength: 1000 }),
        });
        expect(matchesVocabStatus(mastered, 'mastered', undefined, now)).toBe(true);
        expect(matchesVocabStatus(mastered, 'learning', undefined, now)).toBe(false);

        const learning = vocabProgress();
        expect(matchesVocabStatus(learning, 'mastered', undefined, now)).toBe(false);
        expect(matchesVocabStatus(learning, 'learning', undefined, now)).toBe(true);
    });

    it('"due" matches a word with an activated direction due at or before now', () => {
        const due = vocabProgress({ reading: srsEntry({ dueDate: new Date('2026-06-10T11:00:00Z') }) });
        expect(matchesVocabStatus(due, 'due', undefined, now)).toBe(true);

        const notDue = vocabProgress({ reading: srsEntry({ dueDate: new Date('2026-06-11T00:00:00Z') }) });
        expect(matchesVocabStatus(notDue, 'due', undefined, now)).toBe(false);
    });

    it('"struggling" matches a word with 3+ recent wrong results', () => {
        const struggling = vocabProgress({
            reading: srsEntry({ history: [reviewLog({ result: 'wrong', date: 1 }), reviewLog({ result: 'wrong', date: 2 }), reviewLog({ result: 'wrong', date: 3 })] }),
        });
        expect(matchesVocabStatus(struggling, 'struggling', undefined, now)).toBe(true);
        expect(matchesVocabStatus(vocabProgress(), 'struggling', undefined, now)).toBe(false);
    });
});

describe('vocabSortKey', () => {
    const context = { settings: undefined, frequencyRank: new Map([['common', 3]]) };
    const sorted = (words: ReturnType<typeof vocabProgress>[], sort: Parameters<typeof vocabSortKey>[1]) =>
        [...words].sort((a, b) => vocabSortKey(a, sort, context) - vocabSortKey(b, sort, context)).map(w => w.vocabId);

    it('puts the most recently added first', () => {
        const old = vocabProgress({ vocabId: 'old', introductionAt: new Date('2026-01-01') });
        const recent = vocabProgress({ vocabId: 'recent', introductionAt: new Date('2026-05-01') });
        expect(sorted([old, recent], 'recent')).toEqual(['recent', 'old']);
    });

    it('puts the most mistakes first', () => {
        const fine = vocabProgress({ vocabId: 'fine' });
        const hard = vocabProgress({ vocabId: 'hard', meaning: srsEntry({ history: [reviewLog({ result: 'wrong' })] }) });
        expect(sorted([fine, hard], 'mistakes')).toEqual(['hard', 'fine']);
    });

    it('puts words without a frequency rank last', () => {
        const unranked = vocabProgress({ vocabId: 'unranked' });
        const common = vocabProgress({ vocabId: 'common' });
        expect(sorted([unranked, common], 'frequency')).toEqual(['common', 'unranked']);
    });
});
