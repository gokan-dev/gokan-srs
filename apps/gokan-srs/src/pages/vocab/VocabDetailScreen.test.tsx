// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sentence } from '@gokan/dataset-schema';
import { sentence, vocabulary } from '../../test/fixtures';
import VocabDetailScreen from './VocabDetailScreen';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings: null, session: null, grammarSession: null }, actions: {} }),
}));
// A phone (one tab open at a time) unless a test opens the full page.
const screenSize = vi.hoisted(() => ({ isMobile: true }));
vi.mock('../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: screenSize.isMobile, isTablet: false }) }));

// 不思議 with one common pattern held by two of its four sentences.
const word = vocabulary({
    id: 'v-1',
    writtenForm: { kanji: '不思議', alternatives: [], containedKanji: ['不', '思', '議'] },
    reading: { primary: 'ふしぎ', alternatives: [] },
    senses: [{ pos: ['adj-na'], misc: { rawTags: [] }, glosses: ['wonder', 'mystery'], related: { compounds: [] } }],
    patterns: [{ text: '不思議に思う', sentences: 2 }],
});
const sentences: Sentence[] = [
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
        // The full page's Kanji section: left loading, it plays no part here.
        loadKanji: () => new Promise(() => undefined),
    },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    screenSize.isMobile = true;
});

async function renderPage() {
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
}

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
const typeInto = (input: HTMLInputElement, text: string) => {
    act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
};
const shownSentences = () => container.querySelectorAll('[data-example-sentence]').length;

describe('VocabDetailScreen, a common pattern', () => {
    it('filters Sentences on the pattern, and "All N sentences" from Dict lifts the filter', async () => {
        await renderPage();
        click('不思議に思う');
        expect(container.textContent).toContain('Pattern:');
        expect(shownSentences()).toBe(2);

        click('Dict');
        click('All 4 sentences');
        expect(container.textContent).not.toContain('Pattern:');
        expect(shownSentences()).toBe(4);
    });

    it('keeps the filter when Sentences is chosen from the tab row, where its line explains it', async () => {
        await renderPage();
        click('不思議に思う');
        click('Dict');
        click('Sentences');
        expect(container.textContent).toContain('Pattern:');
        expect(shownSentences()).toBe(2);
    });
});

describe('VocabDetailScreen, a common pattern on the full page', () => {
    // Every panel stays on the page: a search typed in Sentences would outlive the filter's change.
    it('starts a fresh Sentences search when a pattern is chosen', async () => {
        screenSize.isMobile = false;
        // Past one page, so Sentences has its field.
        const more = ['n3', 'n4', 'n5'].map(id => sentence({ id, original: `${id}の不思議だ。`, vocabIds: ['v-1'], matches: { 'v-1': [{ start: 3, length: 3 }] } }));
        sentences.push(...more);
        try {
            await renderPage();
            const field = [...container.querySelectorAll('label')].find(l => l.textContent.includes('Search the sentences'))?.querySelector('input');
            if (!field) throw new Error('No Sentences search field');
            // The Sentences section alone: Dict's examples are on the page too.
            const inSentences = () => container.querySelectorAll('[id$="-section-sentence"] [data-example-sentence]').length;
            // 話 is in none of the pattern's sentences.
            typeInto(field, '話');
            expect(inSentences()).toBe(1);

            click('不思議に思う');
            expect(container.textContent).toContain('Pattern:');
            expect(inSentences()).toBe(2);
        } finally {
            sentences.splice(sentences.length - more.length, more.length);
        }
    });
});
