import { describe, it, expect } from 'vitest';
import { SRSService } from './srs.service';
import { CONSTANTS } from '../commons/constants';
import { isMeaningActionable, isReadingActionable } from '../utils/srs.utils';
import { userSettings } from '../test/fixtures';

describe('SRSService Intro Logic (Pure Functions)', () => {

    describe('createVocabProgress', () => {
        it('should create a valid new VocabProgress object', () => {
            const vocabId = 'test-vocab-1';
            const progress = SRSService.createVocabProgress({ id: vocabId });

            expect(progress.vocabId).toBe(vocabId);
            expect(progress.stage).toBe('learning');
            expect(progress.introductionAt).toBeNull(); // Not yet introduced
            expect(progress.nextReviewAt).toBeNull();
            // Checking against initialDifficulty
            expect(progress.reading.difficulty).toBe(CONSTANTS.srs.formula.initialDifficulty);
            expect(progress.usuallyKana).toBe(false);
        });

        it('carries the dataset\'s usuallyKana flag', () => {
            expect(SRSService.createVocabProgress({ id: 'here', usuallyKana: true }).usuallyKana).toBe(true);
        });
    });

    describe('applyVocabIntroChoice', () => {
        it('should set review time to NOW if choice is "learn"', () => {
            const vocabId = 'test-vocab-1';
            const progress = SRSService.createVocabProgress({ id: vocabId });
            const updated = SRSService.applyVocabIntroChoice(progress, 'learn');

            expect(updated.stage).toBe('learning');
            expect(updated.introductionAt).toBeInstanceOf(Date);
            expect(updated.nextReviewAt).toBeInstanceOf(Date);
            // Should be roughly now
            const now = new Date();
            const diff = Math.abs(updated.nextReviewAt!.getTime() - now.getTime());
            expect(diff).toBeLessThan(2000); // 2s buffer
        });

        it('should graduated immediately if choice is "skip"', () => {
            const vocabId = 'test-vocab-1';
            const progress = SRSService.createVocabProgress({ id: vocabId });
            const updated = SRSService.applyVocabIntroChoice(progress, 'skip');

            expect(updated.stage).toBe('graduated');
            expect(updated.introductionAt).toBeInstanceOf(Date);
            expect(updated.nextReviewAt).toBeNull();
            expect(updated.reading.memoryStrength).toBe(CONSTANTS.srs.formula.mastery.maxMemoryStrength);
        });

        it('starts a word learned in kana on meaning, with no reading quiz', () => {
            const progress = SRSService.createVocabProgress({ id: 'here', usuallyKana: true });
            const updated = SRSService.applyVocabIntroChoice(progress, 'learn');
            const soon = new Date(Date.now() + 1000);

            expect(updated.reading.dueDate).toBeNull();
            expect(isReadingActionable(updated, soon)).toBe(false);
            // Meaning is the first review: due now, although nothing was reviewed yet.
            expect(isMeaningActionable(updated, undefined, soon)).toBe(true);
        });

        it('graduates a word learned in kana at once when meaning and production are both off', () => {
            const progress = SRSService.createVocabProgress({ id: 'here', usuallyKana: true });
            const updated = SRSService.applyVocabIntroChoice(progress, 'learn', userSettings({ enableMeaningQuiz: false, enableProductionQuiz: false }));

            expect(updated.stage).toBe('graduated');
            expect(updated.nextReviewAt).toBeNull();
        });
    });
});
