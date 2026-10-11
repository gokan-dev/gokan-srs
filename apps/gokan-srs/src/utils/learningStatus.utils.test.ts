import { describe, expect, it } from 'vitest';
import { STATUS_LABEL, directionStatus, grammarLearningStatus, statusReviewPhrase, vocabLearningStatus } from './learningStatus.utils';
import { grammarProgress, srsEntry, vocabProgress } from '../test/fixtures';
import { CONSTANTS } from '../commons/constants';

const MAX = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

describe('STATUS_LABEL', () => {
    it('names every learning status', () => {
        expect(STATUS_LABEL).toEqual({ new: 'New', learning: 'Learning', mastered: 'Mastered' });
    });
});

describe('vocabLearningStatus', () => {
    it('is New for a word not in the queue', () => {
        expect(vocabLearningStatus(undefined, undefined)).toBe('new');
    });

    it('is Learning until every relevant direction is mastered, then Mastered', () => {
        const settings = { enableMeaningQuiz: true, enableProductionQuiz: false };
        expect(vocabLearningStatus(vocabProgress({ reading: srsEntry({ memoryStrength: MAX }) }), settings)).toBe('learning');
        const mastered = vocabProgress({ reading: srsEntry({ memoryStrength: MAX }), meaning: srsEntry({ memoryStrength: MAX }) });
        expect(vocabLearningStatus(mastered, settings)).toBe('mastered');
    });
});

describe('grammarLearningStatus', () => {
    it('is New until the point is introduced', () => {
        expect(grammarLearningStatus(undefined)).toBe('new');
        expect(grammarLearningStatus(grammarProgress({ introductionAt: null }))).toBe('new');
    });

    it('is Learning, then Mastered at full strength', () => {
        const introductionAt = new Date('2026-01-01');
        expect(grammarLearningStatus(grammarProgress({ introductionAt }))).toBe('learning');
        expect(grammarLearningStatus(grammarProgress({ introductionAt, entry: srsEntry({ memoryStrength: MAX }) }))).toBe('mastered');
    });
});

describe('directionStatus', () => {
    const now = Date.UTC(2026, 3, 19, 12);

    it('is Not started for a direction not activated yet', () => {
        expect(directionStatus(undefined, false, now)).toBe('Not started');
        expect(directionStatus(srsEntry({ dueDate: new Date(now) }), false, now)).toBe('Not started');
    });

    it('is Mastered at full strength, whatever the stored due date', () => {
        expect(directionStatus(srsEntry({ memoryStrength: MAX, dueDate: new Date(now) }), true, now)).toBe('Mastered');
    });

    it('says when the direction is next reviewed', () => {
        expect(directionStatus(srsEntry({ dueDate: new Date(now - 1) }), true, now)).toBe('Due now');
        expect(directionStatus(srsEntry({ dueDate: new Date(now + 2 * 86_400_000) }), true, now)).toBe('Next review in 2 days');
    });
});

describe('statusReviewPhrase', () => {
    const now = Date.UTC(2026, 3, 19, 12);

    it('says when a learning item is next reviewed', () => {
        expect(statusReviewPhrase('learning', new Date(now - 1), now)).toBe('Due now');
        expect(statusReviewPhrase('learning', new Date(now + 3 * 86_400_000), now)).toBe('Next review in 3 days');
        expect(statusReviewPhrase('learning', null, now)).toBe('Not scheduled yet');
    });

    it('never repeats the status of a mastered item', () => {
        expect(statusReviewPhrase('mastered', null, now)).toBeNull();
        expect(statusReviewPhrase('mastered', new Date(now + 3 * 86_400_000), now)).toBe('Next review in 3 days');
    });
});
