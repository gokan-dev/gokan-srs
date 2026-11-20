import { renderToStaticMarkup } from 'react-dom/server';
import { headwordOf } from '@gokan/dataset-schema';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ExerciseTurnApi } from '../../context/quiz/useExerciseTurn';
import { newTurn } from '../../context/quiz/exerciseReducer';
import { vocabExercise } from '../../services/exercise/builders';
import type { Exercise } from '../../services/exercise/types';
import { CONSTANTS } from '../../commons/constants';
import { grammarPoint, sentence, vocabulary } from '../../test/fixtures';
import { gradeExercise } from '../../services/exercise/grading';
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

/** The card, rendered with "Type romaji as kana" on or off, answered or not. */
function cardOf(exercise: Exercise, romajiInput: boolean, turn = newTurn(exercise)): string {
    const api: ExerciseTurnApi = {
        turn,
        setAnswer: () => undefined,
        revealHint: () => undefined,
        submit: () => undefined,
        continueToNext: () => undefined,
        canSubmit: false,
        convertsRomaji: () => romajiInput,
        showContinue: false,
    };
    return renderToStaticMarkup(<MemoryRouter><ExerciseCard api={api} onVocabClick={() => undefined} /></MemoryRouter>);
}

/** The card's answer field. */
function answerInputOf(exercise: Exercise, romajiInput: boolean): string {
    return /<input[^>]*>/.exec(cardOf(exercise, romajiInput))?.[0] ?? '';
}

function placeholderOf(exercise: Exercise, romajiInput: boolean): string | undefined {
    return /placeholder="([^"]*)"/.exec(answerInputOf(exercise, romajiInput))?.[1];
}

/** The input's classes as a list, so `placeholder:font-sans` is matched whole. */
function classesOf(exercise: Exercise, romajiInput: boolean): string[] {
    return (/class="([^"]*)"/.exec(answerInputOf(exercise, romajiInput))?.[1] ?? '').split(/\s+/);
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

    it('draws the placeholder in font-sans whatever its language, while the answer stays gothic', () => {
        const on = classesOf(reading, true);
        expect(on).toContain('placeholder:font-sans');
        expect(on).toContain('font-gothic');
        const off = classesOf(reading, false);
        expect(off).toContain('placeholder:font-sans');
        expect(off).toContain('font-gothic');
        expect(classesOf(conjugation, true)).toContain('placeholder:font-sans');
    });
});

describe('the listening cloze card', () => {
    const written = headwordOf(vocab);
    const heard = sentence({
        id: 's1',
        original: `${written}がある。`,
        en: [{ id: 'en', text: 'There is one.' }],
        matches: { [vocab.id]: [{ start: 0, length: written.length, reading: vocab.reading.primary }] },
        audio: { clip: 'clip-1' },
    });
    const listening = vocabExercise(vocab, { quizType: 'reading', quizMode: 'listening' }, {
        sentence: null,
        cloze: { sentence: heard, blankStart: 0, blankLength: written.length, blankReading: vocab.reading.primary },
    });

    it('asks for the word heard, with its play control and replay key, the word blanked and no English', () => {
        expect(listening.kind).toBe('listening-cloze');
        const html = cardOf(listening, true);
        expect(html).toContain('Type the word you hear');
        expect(html).toContain('data-play-control');
        expect(html).toContain('aria-keyshortcuts="Alt+R"');
        expect(html).toContain('がある。');
        expect(html).not.toContain(`>${written}<`);
        expect(html).not.toContain('There is one.');
        expect(html).toContain('Show the translation');
    });

    it('shows the translation with the feedback', () => {
        const turn = newTurn(listening);
        const grade = gradeExercise(listening, [vocab.reading.primary], [0]);
        const html = cardOf(listening, true, { ...turn, answers: [vocab.reading.primary], feedback: { grade, effects: [] } });
        expect(html).toContain('There is one.');
        expect(html).not.toContain('Show the translation');
    });
});
