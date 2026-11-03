// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sentence } from '@gokan/dataset-schema';
import { sessionRouteRole } from '../context/quiz/sessionRoutes';
import { sentence, vocabulary } from '../test/fixtures';
import VocabIntroCard from './VocabIntroCard';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const shigoto = vocabulary({ id: 'v-shigoto', writtenForm: { kanji: '仕事', alternatives: [], containedKanji: ['仕', '事'] }, reading: { primary: 'しごと', alternatives: [] } });
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
vi.mock('../hooks/useAsyncData', () => ({
    useAsyncData: () => ({ status: 'ready', data: kare, error: undefined }),
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

function mount(shown: Sentence | null): void {
    act(() => root.render(
        <MemoryRouter initialEntries={['/quiz']}>
            <Where />
            <Routes>
                <Route path="/quiz" element={<VocabIntroCard vocab={shigoto} sentence={shown} onVocabClick={() => undefined} onLearn={() => undefined} onSkip={() => undefined} />} />
                <Route path="*" element={null} />
            </Routes>
        </MemoryRouter>,
    ));
}

beforeEach(() => {
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
        // The intro is a study card: no play button, as on every quiz card, though the sentence has a clip.
        expect(shown?.querySelector('[data-play-row] button')).toBeNull();
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
        const triggers = container.querySelectorAll('[data-lookup-trigger]');
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
    });
});
