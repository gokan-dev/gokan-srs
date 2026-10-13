import { describe, it, expect } from 'vitest';
import { missStyleOf, NOTE_MESSAGE_CLASS } from './quizStyles';
import { vocabExercise } from '../../services/exercise/builders';
import { gradeExercise } from '../../services/exercise/grading';
import type { ExerciseGrade, SlotGrade } from '../../services/exercise/types';
import { vocabulary } from '../../test/fixtures';

const meaningOf = (reading: string, glosses: string[]) => vocabExercise(
    vocabulary({ reading: { primary: reading, alternatives: [] }, usuallyKana: true, senses: [{ pos: ['pn'], misc: { rawTags: [] }, glosses, related: { compounds: [] } }] }),
    { quizType: 'meaning', quizMode: 'base' }, { sentence: null, cloze: null },
);
const graded = (slot: SlotGrade): ExerciseGrade => ({ slots: [slot], overall: slot.result, strengthModifier: 1, autoAdvance: false, message: '' });

const NEUTRAL = { accentClass: 'border-l-secondary', inputBorderClass: 'border-secondary', overlay: false };
const MISS = { accentClass: 'border-l-feedback-incorrect/45', inputBorderClass: 'border-feedback-incorrect', overlay: true };

describe('missStyleOf: a neutral miss looks neutral (PR #125)', () => {
    it('gives a sibling demonstrative\'s meaning the near-miss look, without the overlay', () => {
        expect(missStyleOf(gradeExercise(meaningOf('それ', ['that', 'it']), ['this'], [0]))).toEqual(NEUTRAL);
    });

    it('gives a confusable synonym the same look', () => {
        const confusable = graded({
            result: 'wrong', shown: '狭い',
            synonym: { vocabId: 'chiisai', written: '小さい', label: '小さい (ちいさい)', outcome: 'confusable', meaning: null },
        });
        expect(missStyleOf(confusable)).toEqual(NEUTRAL);
    });

    it('keeps the miss look on a plain wrong answer', () => {
        expect(missStyleOf(gradeExercise(meaningOf('それ', ['that', 'it']), ['cat'], [0]))).toEqual(MISS);
    });
});

describe('NOTE_MESSAGE_CLASS (v1.23.0-rc.2 staging review)', () => {
    it('wraps a note only at spaces, so a Japanese word in it never splits across lines', () => {
        expect(NOTE_MESSAGE_CLASS.split(' ')).toContain('break-keep');
    });
});
