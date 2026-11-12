// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
import { sessionRouteRole } from '../context/quiz/sessionRoutes';
import { kanji, sentence, vocabulary } from '../test/fixtures';
import VocabIntroCard from './VocabIntroCard';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const shigoto = vocabulary({ id: 'v-shigoto', writtenForm: { kanji: '仕事', alternatives: [], containedKanji: ['仕', '事'] }, reading: { primary: 'しごと', alternatives: [] }, audio: { clip: 'clip-shigoto' } });
// A word learned in kana: its headword has no kanji to look up.
const koko = vocabulary({ id: 'v-koko', usuallyKana: true, writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] }, reading: { primary: 'ここ', alternatives: [] }, audio: { clip: 'clip-koko' } });
const kare = vocabulary({ id: 'v-kare', writtenForm: { kanji: '彼', alternatives: [], containedKanji: ['彼'] }, reading: { primary: 'かれ', alternatives: [] } });

// 彼 (v-kare) は 仕事 (v-shigoto): the word introduced, and one other word with a card.
const example = sentence({
    original: '彼は仕事',
    en: [{ id: 's1-en', text: 'He, work.' }],
    audio: { clip: 'clip-1' },
    matches: {
        'v-kare': [{ start: 0, length: 1, reading: 'かれ' }],
        'v-shigoto': [{ start: 2, length: 2, reading: 'しごと' }],
    },
});

vi.mock('../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings: null, session: null, grammarSession: null }, actions: {} }),
}));
// A lookup card loads its word (彼) or its kanji (仕), by the key it asks with.
vi.mock('../hooks/useAsyncData', () => ({
    useAsyncData: (key: string) => ({ status: 'ready', data: key === 'v-kare' ? kare : kanji({ character: key }), error: undefined }),
}));
vi.mock('../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));

let container: HTMLDivElement;
let root: Root;
/** Where the router is, written after each render. */
const where = { path: '' };

function Where() {
    const { pathname } = useLocation();
    useEffect(() => { where.path = pathname; });
    return null;
}

const choices = { learn: vi.fn(), skip: vi.fn() };

function mount(shown: Sentence | null, word: Vocabulary = shigoto): void {
    act(() => root.render(
        <MemoryRouter initialEntries={['/quiz']}>
            <Where />
            <Routes>
                <Route path="/quiz" element={<VocabIntroCard vocab={word} sentence={shown} onVocabClick={() => undefined} onLearn={choices.learn} onSkip={choices.skip} />} />
                <Route path="*" element={null} />
            </Routes>
        </MemoryRouter>,
    ));
}

beforeEach(() => {
    choices.learn.mockClear();
    choices.skip.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('VocabIntroCard', () => {
    it('shows the word in use: the sentence with the word highlighted, and its English', () => {
        mount(example);
        const shown = container.querySelector('[data-example-sentence]');
        // Furigana over every word, the introduced one highlighted.
        expect([...(shown?.querySelectorAll('rt') ?? [])].map(rt => rt.textContent)).toEqual(['かれ', 'しごと']);
        expect(shown?.querySelector('.text-accent')?.textContent).toContain('仕事');
        expect(shown?.textContent).toContain('He, work.');
        // It plays: the intro comes before any exercise on the word, so hearing it gives nothing away.
        expect(shown?.querySelector('[data-play-row] button')?.getAttribute('aria-label')).toBe('Play sentence');
        // A session card keeps its sentence words out of the Tab order (DESIGN_SYSTEM section 6).
        expect(shown?.querySelector('[tabindex="0"]')).toBeNull();
        expect(shown?.querySelector('[role="button"]')).toBeNull();
    });

    it('renders no sentence section for a word with no usable sentence', () => {
        mount(null);
        expect(container.querySelector('[data-example-sentence]')).toBeNull();
        expect(container.querySelector('[data-sentence]')).toBeNull();
    });

    it("opens a sentence word's page, a page that pauses the session rather than ending it", () => {
        mount(example);
        const triggers = container.querySelectorAll('[data-example-sentence] [data-lookup-trigger]');
        // The introduced word is highlighted, never its own card; the other word is.
        expect(triggers).toHaveLength(1);
        act(() => {
            triggers[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
            triggers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        const open = [...document.querySelectorAll('a')].find(a => a.textContent === 'Open word page');
        expect(where.path).toBe('/quiz');
        if (!open) throw new Error('the word card has no link to its page');
        act(() => { open.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 })); });
        expect(where.path).toBe('/vocab/v-kare');
        expect(sessionRouteRole(where.path, 'vocab')).toBe('consult');
        // Opening a page is neither Learn nor Skip: the intro is still waiting on return.
        expect(choices.learn).not.toHaveBeenCalled();
        expect(choices.skip).not.toHaveBeenCalled();
    });

    it("plays the word's reading after it, when it has a clip", () => {
        mount(example);
        const reading = container.querySelector('[data-word-reading]');
        expect(reading?.textContent).toContain('しごと');
        expect(reading?.querySelector('[data-play-button]')?.getAttribute('aria-label')).toBe('Play 仕事');
    });

    it('lists every reading as its own unit, so a wrapping list breaks only between readings', () => {
        mount(null, { ...shigoto, reading: { primary: 'に', alternatives: ['ふた', 'アール'] } });
        const reading = container.querySelector('[data-word-reading]');
        expect([...(reading?.querySelectorAll('span[lang=ja]') ?? [])].map(el => el.textContent)).toEqual(['に', 'ふた', 'アール']);
        expect(reading?.textContent).toContain('に, ふた, アール');
    });

    it("keeps one centre axis: the reading's and (from md) the sentence's buttons balanced by spacers", () => {
        mount(example);
        const reading = container.querySelector('[data-word-reading]');
        expect(reading?.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
        // The sentence row is content-width and centred at every width, so its button follows the
        // sentence; from md a spacer before it balances the button.
        const row = container.querySelector('[data-play-row]');
        expect(row?.className).toContain('w-fit max-w-full mx-auto');
        expect(row?.className).not.toContain('md:w-fit');
        expect(row?.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
        expect(row?.firstElementChild?.className).toContain('hidden md:block');
        // On a phone the translation is centred on the sentence's column, the button's width set aside.
        const english = container.querySelector('[data-sentence-english]');
        expect(english?.textContent).toBe('He, work.');
        expect(english?.className).toContain('pr-12 md:pr-0');
        // No clip, no button, and nothing to balance.
        mount(sentence({ ...example, audio: undefined }), { ...shigoto, audio: undefined });
        expect(container.querySelector('[data-word-reading]')?.firstElementChild?.getAttribute('aria-hidden')).toBeNull();
        expect(container.querySelector('[data-play-row]')?.firstElementChild?.getAttribute('aria-hidden')).toBeNull();
        expect(container.querySelector('[data-sentence-english]')?.className).not.toContain('pr-12');
    });

    it('shows no play button for a word or a sentence without a clip, never a disabled one', () => {
        mount(sentence({ ...example, audio: undefined }), { ...shigoto, audio: undefined });
        expect(container.querySelector('[data-play-button]')).toBeNull();
    });

    it('puts the play button of a word learned in kana on its kanji spelling line, as its page does', () => {
        mount(null, koko);
        const line = container.querySelector('[data-word-reading]');
        expect(line?.textContent).toContain('此処');
        expect(line?.querySelector('[data-play-button]')?.getAttribute('aria-label')).toBe('Play ここ');
        // Balanced from md up only: on a phone the note keeps the spacer's width for its words.
        expect(line?.firstElementChild?.className).toContain('hidden md:block');
        // Its kanji spelling wraps only as a whole.
        expect(line?.querySelector('span[lang=ja]')?.textContent).toBe('此処');
        // Its headword is kana: nothing to look up.
        expect(container.querySelector('[data-intro-headword] [data-lookup-trigger]')).toBeNull();
    });

    it('sizes a long headword by its character count and keeps its parts inline, so no kana run wraps on its own (issue 239)', () => {
        const norikaeru = vocabulary({ id: 'v-norikaeru', writtenForm: { kanji: '乗り換える', alternatives: [], containedKanji: ['乗', '換'] }, reading: { primary: 'のりかえる', alternatives: [] } });
        mount(null, norikaeru);
        const shown = container.querySelector<HTMLElement>('[data-intro-headword] [data-display-headword]');
        expect(shown?.textContent).toBe('乗り換える');
        // The size that fits is the card's width over this count (.text-kanji, index.css).
        expect(shown?.style.getPropertyValue('--headword-chars')).toBe('5');
        expect(shown?.parentElement?.className).toContain('headword-fit');
        // Flex items shrink to one character's width, which stacked the trailing kana: none here.
        const flexed = [shown, shown?.parentElement, shown?.parentElement?.parentElement].filter(el => /(^|\s)(inline-)?flex(\s|$)/.test(el?.className ?? ''));
        expect(flexed).toEqual([]);
    });

    it("makes each of the headword's kanji a lookup trigger, its card opening the kanji's page", () => {
        mount(null);
        const triggers = [...container.querySelectorAll('[data-intro-headword] [data-lookup-trigger]')];
        expect(triggers.map(t => t.textContent)).toEqual(['仕', '事']);
        // Reachable by Tab, unlike the sentence's words.
        expect(triggers.every(t => t.getAttribute('tabindex') === '0')).toBe(true);
        act(() => {
            triggers[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
            triggers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        const open = [...document.querySelectorAll('a')].find(a => a.textContent === 'Open kanji page');
        if (!open) throw new Error('the kanji card has no link to its page');
        act(() => { open.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 })); });
        expect(sessionRouteRole(where.path, 'vocab')).toBe('consult');
        expect(choices.learn).not.toHaveBeenCalled();
        expect(choices.skip).not.toHaveBeenCalled();
    });
});
