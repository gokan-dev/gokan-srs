import { describe, it, expect } from 'vitest';
import { blankBorderClass, missStyleOf } from './quizStyles';
import { vocabExercise } from '../../services/exercise/builders';
import { gradeExercise } from '../../services/exercise/grading';
import type { ExerciseGrade, SlotGrade } from '../../services/exercise/types';
import { vocabulary } from '../../test/fixtures';

const meaningOf = (reading: string, glosses: string[]) => vocabExercise(
    vocabulary({ reading: { primary: reading, alternatives: [] }, usuallyKana: true, senses: [{ pos: ['pn'], misc: { rawTags: [] }, glosses, related: { compounds: [] } }] }),
    { quizType: 'meaning', quizMode: 'base' }, { sentence: null, cloze: null },
);
const graded = (slot: SlotGrade): ExerciseGrade => ({ slots: [slot], overall: slot.result, strengthModifier: 1, autoAdvance: false, message: '' });

const NEUTRAL = { accentClass: 'border-l-secondary', inputBorderClass: 'border-secondary', overlay: false, heading: 'Correct answer' };
const ACCEPTED = { accentClass: 'border-l-secondary', inputBorderClass: 'border-secondary', overlay: false, heading: 'The word being tested' };
const MISS = { accentClass: 'border-l-feedback-incorrect/45', inputBorderClass: 'border-feedback-incorrect', overlay: true, heading: 'Correct answer' };

describe('missStyleOf: a neutral miss looks neutral (PR #125), an accepted answer accepted (issue #150)', () => {
    it('gives a sibling demonstrative\'s meaning the near-miss look, without the overlay', () => {
        expect(missStyleOf(gradeExercise(meaningOf('それ', ['that', 'it']), ['this'], [0]))).toEqual(NEUTRAL);
    });

    it('gives a confusable synonym the same look', () => {
        const confusable = graded({
            result: 'wrong', shown: '狭い',
            synonym: { vocabId: 'chiisai', written: '小さい', label: '小さい (ちいさい)', outcome: 'confusable', relation: { tier: 'confusable', curated: false, shared: ['small'], meaning: null } },
        });
        expect(missStyleOf(confusable)).toEqual(NEUTRAL);
    });

    // 恐らく on a 多分 card: "is also accepted here", so it is not drawn as wrong (issue #150).
    it('never draws an accepted synonym as wrong', () => {
        const accepted = graded({
            result: 'minor_error', shown: 'たぶん',
            synonym: { vocabId: 'osoraku', written: '恐らく', label: '恐らく (おそらく)', outcome: 'minor_error', relation: { tier: 'interchangeable', curated: true, shared: ['probably'], meaning: null } },
        });
        expect(missStyleOf(accepted)).toEqual(ACCEPTED);
    });

    it('keeps the miss look on a near miss of the word itself', () => {
        expect(missStyleOf(graded({ result: 'minor_error', shown: 'たぶん' })).overlay).toBe(true);
    });

    it('keeps the miss look on a plain wrong answer', () => {
        expect(missStyleOf(gradeExercise(meaningOf('それ', ['that', 'it']), ['cat'], [0]))).toEqual(MISS);
    });
});

describe('blankBorderClass', () => {
    const shown = { feedbackShown: true, revealed: false };
    it('mutes a neutral blank rather than drawing it wrong', () => {
        const neutral: SlotGrade = { result: 'wrong', shown: '狭い', synonym: { vocabId: 'c', written: '小さい', label: '小さい', outcome: 'confusable', relation: { tier: 'confusable', curated: false, shared: ['small'], meaning: null } } };
        expect(blankBorderClass(neutral, shown)).toBe('border-secondary');
        expect(blankBorderClass({ result: 'wrong', shown: '狭い' }, shown)).toBe('border-feedback-incorrect');
    });
});
