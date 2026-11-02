import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ExerciseTurnApi } from '../../context/quiz/useExerciseTurn';
import { newTurn } from '../../context/quiz/exerciseReducer';
import { vocabExercise } from '../../services/exercise/builders';
import type { Exercise } from '../../services/exercise/types';
import { CONSTANTS } from '../../commons/constants';
import { grammarPoint, vocabulary } from '../../test/fixtures';
import { ExerciseCard } from './ExerciseCard';

const vocab = vocabulary();
const point = grammarPoint();

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { currentVocab: vocab, currentGrammarPoint: point }, currentProgress: null, currentGrammarProgress: null }),
}));
vi.mock('../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));

const reading = vocabExercise(vocab, { quizType: 'reading', quizMode: 'base' }, { sentence: null, cloze: null });
const conjugation: Exercise = {
    host: { kind: 'grammar', grammarId: point.id },
    label: point.title,
    slots: reading.slots,
    kind: 'conjugation',
    cue: {},
    prompt: { lemma: '食べる', lemmaReading: 'たべる', formLabel: 'て-form', wordClass: 'ichidan', target: '食べて', targetReading: 'たべて' },
};

/** The card's answer field placeholder, with "Type romaji as kana" on or off. */
function placeholderOf(exercise: Exercise, romajiInput: boolean): string | undefined {
    const api: ExerciseTurnApi = {
        turn: newTurn(exercise),
        setAnswer: () => undefined,
        revealHint: () => undefined,
        submit: () => undefined,
        continueToNext: () => undefined,
        canSubmit: false,
        convertsRomaji: () => romajiInput,
        showContinue: false,
    };
    const html = renderToStaticMarkup(<MemoryRouter><ExerciseCard api={api} onVocabClick={() => undefined} /></MemoryRouter>);
    return /<input[^>]*placeholder="([^"]*)"/.exec(html)?.[1];
}

describe('ExerciseCard placeholders', () => {
    it('says romaji works on a reading card that converts, and asks for hiragana on one that does not', () => {
        expect(placeholderOf(reading, true)).toBe(CONSTANTS.quiz.romajiAnswerPlaceholder);
        expect(placeholderOf(reading, false)).toBe(CONSTANTS.quiz.hiraganaAnswerPlaceholder);
    });

    it('keeps the conjugation card asking for the form', () => {
        expect(placeholderOf(conjugation, true)).toBe('Type the form, in romaji or kana');
        expect(placeholderOf(conjugation, false)).toBe('Type the form...');
    });
});
