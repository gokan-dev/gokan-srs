// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { headwordOf, kanaToHepburn } from '@gokan/dataset-schema';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseTurnApi } from '../../context/quiz/useExerciseTurn';
import { newTurn, type ExerciseTurn } from '../../context/quiz/exerciseReducer';
import { clipPlayer } from '../../services/clipPlayer';
import { vocabExercise } from '../../services/exercise/builders';
import type { Exercise } from '../../services/exercise/types';
import { CONSTANTS } from '../../commons/constants';
import { grammarExample, grammarPoint, sentence, vocabulary } from '../../test/fixtures';
import { gradeExercise } from '../../services/exercise/grading';
import { ExerciseCard } from './ExerciseCard';
import { drillCardsOf } from '../../context/quiz/drillSelectors';

const vocab = vocabulary();
const point = grammarPoint();

/** The word the card is about (the quiz's current word); a test may switch it. */
let currentVocab = vocab;

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { currentVocab, currentGrammarPoint: point }, currentProgress: null, currentGrammarProgress: null }),
}));
vi.mock('../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));

/** How the fake clip's next start ends: it plays (and keeps playing until stopped), or autoplay blocks it. */
const clip = vi.hoisted(() => {
    const state: { next: 'played' | 'blocked' } = { next: 'played' };
    return state;
});
vi.mock('../../services/clipPlayer', async () => {
    const { createClipPlayer } = await import('@gokan/dataset-schema');
    const blocked = () => Object.assign(new Error('autoplay'), { name: 'NotAllowedError' });
    return {
        clipPlayer: createClipPlayer({
            urlOf: c => Promise.resolve(`/audio/${c}.opus`),
            open: () => ({
                play: () => (clip.next === 'blocked' ? Promise.reject(blocked()) : Promise.resolve()),
                pause: () => undefined,
                addEventListener: () => undefined,
            }),
        }),
    };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// The card frame's entrance has nothing to test, and happy-dom cancels it mid-way.
MotionGlobalConfig.skipAnimations = true;

const reading = vocabExercise(vocab, { quizType: 'reading', quizMode: 'base' }, { sentence: null, cloze: null });
const conjugation: Exercise = {
    host: { kind: 'grammar', grammarId: point.id },
    label: point.title,
    slots: reading.slots,
    kind: 'conjugation',
    cue: {},
    prompt: { lemma: '食べる', lemmaReading: 'たべる', formLabel: 'て-form', wordClass: 'ichidan', target: '食べて', targetReading: 'たべて' },
};

/** A card's turn API over `turn`, with "Type romaji as kana" on or off; only `markUnheard` does anything. */
function apiOf(turn: ExerciseTurn, romajiInput: boolean, markUnheard: () => void = () => undefined): ExerciseTurnApi {
    return {
        turn,
        setAnswer: () => undefined,
        revealHint: () => undefined,
        submit: () => undefined,
        markUnheard,
        continueToNext: () => undefined,
        canSubmit: false,
        convertsRomaji: () => romajiInput,
        showContinue: false,
    };
}

/** The card, rendered with "Type romaji as kana" on or off, answered or not. */
function cardOf(exercise: Exercise, romajiInput: boolean, turn = newTurn(exercise)): string {
    return renderToStaticMarkup(<MemoryRouter><ExerciseCard api={apiOf(turn, romajiInput)} onVocabClick={() => undefined} /></MemoryRouter>);
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

    /** The card answered with `typed`, graded. */
    const answeredWith = (typed: string, turn: ExerciseTurn = newTurn(listening)): ExerciseTurn =>
        ({ ...turn, answers: [typed], feedback: { grade: gradeExercise(listening, [typed], [0]), effects: [] } });

    it('shows the translation with the feedback', () => {
        const html = cardOf(listening, true, answeredWith(vocab.reading.primary));
        expect(html).toContain('There is one.');
        expect(html).not.toContain('Show the translation');
    });

    /** The written form shown beside the blank: its text and its furigana. */
    const revealOf = (html: string) => {
        const reveal = /<button[^>]*title="Open the page for [^"]*"[^>]*>(.*?)<\/button>/.exec(html)?.[1] ?? '';
        return {
            text: reveal.replace(/<rt[^>]*>.*?<\/rt>|<[^>]+>/g, ''),
            furigana: [...reveal.matchAll(/<rt[^>]*>(.*?)<\/rt>/g)].map(m => m[1]).join(''),
        };
    };

    it('shows the word as written beside a right answer typed in kana, with no furigana repeating it', () => {
        expect(gradeExercise(listening, [vocab.reading.primary], [0]).overall).toBe('correct');
        expect(revealOf(cardOf(listening, true, answeredWith(vocab.reading.primary)))).toEqual({ text: written, furigana: '' });
    });

    it('keeps the reading as furigana beside an answer not typed as that reading', () => {
        const romaji = kanaToHepburn(vocab.reading.primary);
        expect(romaji).not.toBe(vocab.reading.primary);
        expect(revealOf(cardOf(listening, true, answeredWith(romaji)))).toEqual({ text: written, furigana: vocab.reading.primary });
    });

    it('adds nothing beside a right answer typed as written', () => {
        expect(cardOf(listening, true, answeredWith(written))).not.toContain('Open the page for');
    });

    describe('in the page', () => {
        let container: HTMLDivElement;
        let root: Root;
        /** The turn as the reducer would hold it: `markUnheard` sets `unheard`, `answer` grades. */
        let answer: (typed: string) => void = () => undefined;

        function Harness() {
            const [turn, setTurn] = useState<ExerciseTurn>(newTurn(listening));
            answer = typed => setTurn(t => answeredWith(typed, t));
            const api = apiOf(turn, true, () => setTurn(t => ({ ...t, unheard: true })));
            return <MemoryRouter><ExerciseCard api={api} onVocabClick={() => undefined} /></MemoryRouter>;
        }

        /** Runs `step`, then lets the clip's start (its URL, then its playback) settle. */
        const settled = (step: () => void) => act(async () => {
            step();
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        /** Renders the card, its clip's start on show ending as `onShow`. */
        async function show(onShow: 'played' | 'blocked') {
            clip.next = onShow;
            await settled(() => root.render(<Harness />));
        }

        const control = () => container.querySelector<HTMLButtonElement>('[data-play-control]')!;
        const textButton = () => [...container.querySelectorAll('button')].find(b => b.textContent.includes('Show the translation'));
        const instruction = () => [...container.querySelectorAll('p')].find(p => /Fill in the blank|Type the word you hear/.test(p.textContent))?.textContent;
        /** The control's accessible name: its visible words, without the unseen ones that hold its width. */
        const nameOf = (button: HTMLButtonElement) =>
            [...button.querySelectorAll('span')].filter(s => s.getAttribute('aria-hidden') !== 'true' && s.children.length === 0).map(s => s.textContent).join('');

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
            root = createRoot(container);
        });

        afterEach(() => {
            act(() => root.unmount());
            container.remove();
            clipPlayer.stopIf('clip-1');
            currentVocab = vocab;
        });

        it('says "Play" for a clip autoplay blocked and through its first play, then "Play again", with aria-pressed telling which', async () => {
            await show('blocked');
            expect(nameOf(control())).toBe('Play');
            expect(control().getAttribute('aria-pressed')).toBe('false');
            expect(control().textContent).not.toContain('Stop');

            clip.next = 'played';
            await settled(() => control().click());
            expect(nameOf(control())).toBe('Play');
            expect(control().getAttribute('aria-pressed')).toBe('true');

            await settled(() => control().click());
            expect(nameOf(control())).toBe('Play again');
            expect(control().getAttribute('aria-pressed')).toBe('false');

            await settled(() => control().click());
            expect(nameOf(control())).toBe('Play again');
            expect(control().getAttribute('aria-pressed')).toBe('true');
        });

        it('says "Play" while the clip played on show is still playing, and "Play again" once it ends', async () => {
            await show('played');
            expect(clipPlayer.playing()).toBe('clip-1');
            expect(nameOf(control())).toBe('Play');

            await settled(() => clipPlayer.stopIf('clip-1'));
            expect(nameOf(control())).toBe('Play again');
        });

        it('plays again, and says "Play" again, on the next word asked from the same sentence', async () => {
            const other = vocabulary({ id: 'other' });
            const shared = sentence({ ...heard, matches: { ...heard.matches, [other.id]: heard.matches?.[vocab.id] ?? [] } });
            const cloze = { sentence: shared, blankStart: 0, blankLength: written.length, blankReading: vocab.reading.primary };
            const cardFor = (word: typeof vocab) => {
                const exercise = vocabExercise(word, { quizType: 'reading', quizMode: 'listening' }, { sentence: null, cloze });
                return <MemoryRouter><ExerciseCard api={apiOf(newTurn(exercise), true)} onVocabClick={() => undefined} /></MemoryRouter>;
            };
            clip.next = 'played';
            await settled(() => root.render(cardFor(vocab)));
            await settled(() => clipPlayer.stopIf('clip-1'));
            expect(nameOf(control())).toBe('Play again');

            currentVocab = other;
            await settled(() => root.render(cardFor(other)));
            expect(clipPlayer.playing()).toBe('clip-1');
            expect(nameOf(control())).toBe('Play');
        });

        it('keeps the same width for both labels: the longer one is always laid out', async () => {
            await show('blocked');
            const hidden = control().querySelector('[aria-hidden="true"].invisible');
            expect(hidden?.textContent).toBe('Play again');
        });

        it('stops the clip on "Show the translation", and keeps "Fill in the blank" once answered', async () => {
            await show('played');
            expect(clipPlayer.playing()).toBe('clip-1');
            expect(control().getAttribute('aria-pressed')).toBe('true');

            await settled(() => textButton()?.click());
            expect(clipPlayer.playing()).toBeNull();
            expect(control().getAttribute('aria-pressed')).toBe('false');
            expect(instruction()).toBe('Fill in the blank');
            expect(container.textContent).toContain('There is one.');

            await settled(() => answer(vocab.reading.primary));
            expect(instruction()).toBe('Fill in the blank');
        });

        it('puts focus back in the blank on "Show the translation"', async () => {
            await show('blocked');
            textButton()?.focus();
            await settled(() => textButton()?.click());
            // The focus is moved on the next tick (useQuizFocusManagement).
            await settled(() => undefined);
            expect(document.activeElement).toBe(container.querySelector('input'));
        });
    });
});

describe('a contrast drill card (issue 249)', () => {
    const family = { id: 'reason', name: 'Reason', relatedPoints: [] };
    const tokens = (lead: string, marker: string) => grammarExample({ jp: `${lead}${marker}`, words: [{ surface: lead, vocabId: null }, { surface: marker, vocabId: null }], patternWordIndices: [1] });
    const kara = grammarPoint({ id: 'kara', title: '～から', slot: 'clause-final', formation: 'Clause + から', family, examples: [tokens('雨だ', 'から')] });
    const karadesu = grammarPoint({ id: 'karadesu', title: '～からです', slot: 'predicate-final', formation: 'Clause + からです', family, examples: [tokens('雨だ', 'からです')] });
    // おかげで has no slot: its sentence rules から out by connection.
    const okage = grammarPoint({ id: 'okage', title: '～おかげで', formation: 'Noun + のおかげで', family, examples: [{ ...tokens('先生の', 'おかげで'), ruledOut: ['kara'] }] });
    const info = (p: typeof kara) => ({ id: p.id, title: p.title, jlptLevel: p.jlptLevel, marker: p.title, comparedOn: null });
    // から's card offers からです (another place in a sentence); a case covers that pair, none covers おかげで's.
    const taught = { focus: 'karadesu', vs: ['kara'], situation: 'Giving the reason as the answer.', guidance: 'からです ends the sentence.' };
    const cards = drillCardsOf([kara, karadesu, okage].map(p => ({ point: p, examples: p.examples })), [taught], 'seed', info);
    const cardOfPoint = (id: string) => {
        const card = cards.find(c => c.point.id === id);
        if (!card) throw new Error(`no drill card for ${id}`);
        return card;
    };
    /** The card answered with the wrong option naming `pointId`. */
    const pickedWrong = (card: ReturnType<typeof cardOfPoint>, pointId: string): ExerciseTurn => {
        const text = card.slots[0].choices?.find(c => c.pointId === pointId)?.text ?? '';
        return { ...newTurn(card), answers: [text], feedback: { grade: gradeExercise(card, [text], [0]), effects: [] } };
    };

    it('shows the contrast case of the pair after a wrong pick the dataset has one for', () => {
        const card = cardOfPoint('kara');
        const html = cardOf(card, true, pickedWrong(card, 'karadesu'));
        expect(html).toContain('Which one, and when');
        expect(html).toContain('Giving the reason as the answer.');
    });

    it('shows none for a pair with no case, nor before the card is answered', () => {
        const card = cardOfPoint('okage');
        expect(cardOf(card, true, pickedWrong(card, 'kara'))).not.toContain('Which one, and when');
        expect(cardOf(cardOfPoint('kara'), true)).not.toContain('Which one, and when');
    });

    it('sets the Japanese of a usage note in a Japanese face, upright', () => {
        const noted = { ...kara, usageNote: 'は marks the topic, what the sentence is about (私は学生です).' };
        const [card] = drillCardsOf([noted, karadesu].map(p => ({ point: p, examples: p.examples })), [], 'seed', p => ({ ...info(p), usageNote: p.usageNote }));
        const html = cardOf(card, true, pickedWrong(card, 'karadesu'));
        expect(html).toContain('<span class="font-gothic" lang="ja">私は学生です</span>');
        // The note's own paragraph, found first, so the italic check cannot pass by matching nothing.
        const noteClass = /<p class="([^"]*)"><span class="font-gothic" lang="ja">は<\/span> marks the topic/.exec(html)?.[1];
        expect(noteClass).toBeDefined();
        expect(noteClass?.split(' ')).not.toContain('italic');
    });

    it('asks a contrast case\'s situation, with no sentence, its points picked among under it', () => {
        const card = cards.find(c => c.situation !== undefined);
        if (!card) throw new Error('no case card');
        const html = cardOf(card, true);
        expect(html).toContain('Choose what fits the situation best');
        expect(html).toContain('Giving the reason as the answer.');
        expect(html).not.toContain('Choose what fits the sentence');
        expect(html).toContain('からです');
    });

    it('explains a case card through the case\'s guidance block after a wrong pick, and not after a right one', () => {
        const someone = grammarPoint({ id: 'dareka', title: 'だれか', family, examples: [] });
        const noOne = grammarPoint({ id: 'daremo', title: 'だれも', family, examples: [] });
        const who = { focus: 'daremo', vs: ['dareka'], situation: 'Nobody came.', guidance: 'Use だれも with a negative verb: だれも来ませんでした.' };
        const [card] = drillCardsOf([someone, noOne].map(p => ({ point: p, examples: p.examples })), [who], 'seed', info);
        if (!card) throw new Error('no case card');
        const wrong = cardOf(card, true, pickedWrong(card, 'dareka'));
        // The guidance once, in the shared block, without the situation (the card's question).
        const block = /<div class="border-l-2 border-accent\/40 pl-3[^"]*">(.*?)<\/div>/.exec(wrong)?.[1] ?? '';
        expect(block).toContain('Which one, and when');
        expect(block).toContain('<span class="font-gothic" lang="ja">だれも</span>');
        expect(block).not.toContain('Nobody came.');
        expect(wrong.split('with a negative verb')).toHaveLength(2);
        const right = cardOf(card, true, { ...newTurn(card), answers: ['だれも'], feedback: { grade: gradeExercise(card, ['だれも'], [0]), effects: [] } });
        expect(right).not.toContain('with a negative verb');
    });

    it('names its own point, read from the card, and shows no mastery ring', () => {
        const card = cardOfPoint('okage');
        const html = cardOf(card, true, pickedWrong(card, 'kara'));
        expect(html).toContain('/grammar/okage');
        expect(html).not.toContain('role="img"');
    });
});
