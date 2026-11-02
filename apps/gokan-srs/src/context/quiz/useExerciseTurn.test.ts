import { describe, expect, it } from 'vitest';
import { vocabExercise } from '../../services/exercise/builders';
import { vocabulary } from '../../test/fixtures';
import { submittedAnswers } from './useExerciseTurn';

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
