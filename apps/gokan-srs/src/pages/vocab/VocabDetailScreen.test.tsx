// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentence, vocabulary } from '../../test/fixtures';
import VocabDetailScreen from './VocabDetailScreen';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings: null, session: null, grammarSession: null }, actions: {} }),
}));
// A phone: one tab open at a time.
vi.mock('../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: true, isTablet: false }) }));

// 不思議 with one common pattern held by two of its four sentences.
const word = vocabulary({
    id: 'v-1',
    writtenForm: { kanji: '不思議', alternatives: [], containedKanji: ['不', '思', '議'] },
    reading: { primary: 'ふしぎ', alternatives: [] },
    senses: [{ pos: ['adj-na'], misc: { rawTags: [] }, glosses: ['wonder', 'mystery'], related: { compounds: [] } }],
    patterns: [{ text: '不思議に思う', sentences: 2 }],
});
const sentences = [
    sentence({ id: 'p1', original: '不思議に思う。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 0, length: 3, pattern: 0 }] } }),
    sentence({ id: 'p2', original: 'それを不思議に思った。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 3, length: 3, pattern: 0 }] } }),
    sentence({ id: 'n1', original: '不思議な話だ。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 0, length: 3 }] } }),
    sentence({ id: 'n2', original: '不思議だ。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 0, length: 3 }] } }),
];

// The open tab is kept for the session: not kept here, so each test starts on Dict.
vi.mock('../../hooks/usePersistedControls', () => ({
    usePersistedControlsSnapshot: () => ({}),
    writePersistedControls: () => undefined,
}));

vi.mock('../../services/vocabulary.service', () => ({
    VocabularyService: {
        loadVocab: () => Promise.resolve(word),
        loadSentences: () => Promise.resolve(sentences),
    },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // The word and its sentences load: the page settles once their promises resolve.
    await act(async () => {
        root.render(
            <MemoryRouter initialEntries={['/vocab/v-1']}>
                <Routes><Route path="/vocab/:vocabId" element={<VocabDetailScreen />} /></Routes>
            </MemoryRouter>,
        );
        await Promise.resolve();
    });
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent.replace(/\s+/g, ' ').trim().startsWith(text));
const click = (text: string) => {
    const target = button(text);
    if (!target) throw new Error(`No button "${text}"`);
    act(() => target.click());
};
const shownSentences = () => container.querySelectorAll('[data-example-sentence]').length;

describe('VocabDetailScreen, a common pattern', () => {
    it('filters Sentences on the pattern, and "All N sentences" from Dict lifts the filter', () => {
        click('不思議に思う');
        expect(container.textContent).toContain('Pattern:');
        expect(shownSentences()).toBe(2);

        click('Dict');
        click('All 4 sentences');
        expect(container.textContent).not.toContain('Pattern:');
        expect(shownSentences()).toBe(4);
    });

    it('keeps the filter when Sentences is chosen from the tab row, where its line explains it', () => {
        click('不思議に思う');
        click('Dict');
        click('Sentences');
        expect(container.textContent).toContain('Pattern:');
        expect(shownSentences()).toBe(2);
    });
});
