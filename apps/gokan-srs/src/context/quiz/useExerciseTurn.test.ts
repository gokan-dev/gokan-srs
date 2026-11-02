import { describe, expect, it } from 'vitest';
import { vocabExercise } from '../../services/exercise/builders';
import { vocabulary } from '../../test/fixtures';
import { slotConvertsRomaji, submittedAnswers } from './useExerciseTurn';

const exerciseOf = (quizType: 'reading' | 'meaning') =>
    vocabExercise(vocabulary(), { quizType, quizMode: 'base' }, { sentence: null, cloze: null });

describe('submittedAnswers', () => {
    it('settles a Japanese answer as submitted: all of it converted, a final n as ん', () => {
        expect(submittedAnswers(exerciseOf('reading'), ['nihon'], true)).toEqual(['にほん']);
        expect(submittedAnswers(exerciseOf('reading'), ['にほn'], true)).toEqual(['にほん']);
    });

    it('never converts an English answer', () => {
        expect(submittedAnswers(exerciseOf('meaning'), ['japan'], true)).toEqual(['japan']);
    });

    it('leaves every answer as typed with the setting off', () => {
        expect(submittedAnswers(exerciseOf('reading'), ['nihon'], false)).toEqual(['nihon']);
    });
});

describe('slotConvertsRomaji', () => {
    it('converts a Japanese slot with the setting on', () => {
        expect(slotConvertsRomaji(exerciseOf('reading'), 0, true)).toBe(true);
    });

    it('never converts an English slot', () => {
        expect(slotConvertsRomaji(exerciseOf('meaning'), 0, true)).toBe(false);
    });

    it('converts nothing with the setting off, or past the last slot', () => {
        expect(slotConvertsRomaji(exerciseOf('reading'), 0, false)).toBe(false);
        expect(slotConvertsRomaji(exerciseOf('reading'), 1, true)).toBe(false);
        expect(slotConvertsRomaji(undefined, 0, true)).toBe(false);
    });
});
