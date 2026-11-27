// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
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
const baseSentences = (): Sentence[] => [
    sentence({ id: 'p1', original: '不思議に思う。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 0, length: 3, pattern: 0 }] } }),
    sentence({ id: 'p2', original: 'それを不思議に思った。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 3, length: 3, pattern: 0 }] } }),
    sentence({ id: 'n1', original: '不思議な話だ。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 0, length: 3 }] } }),
    sentence({ id: 'n2', original: '不思議だ。', vocabIds: ['v-1'], matches: { 'v-1': [{ start: 0, length: 3 }] } }),
];
// The current test's word and its sentences: fresh each test, set in `beforeEach`.
const current = vi.hoisted((): { word: Vocabulary | null; sentences: readonly Sentence[] } => ({ word: null, sentences: [] }));

// The open tab is kept for the session: not kept here, so each test starts on Dict.
vi.mock('../../hooks/usePersistedControls', () => ({
    usePersistedControlsSnapshot: () => ({}),
    writePersistedControls: () => undefined,
}));

vi.mock('../../services/vocabulary.service', () => ({
    VocabularyService: {
        loadVocab: () => Promise.resolve(current.word),
        loadSentences: () => Promise.resolve(current.sentences),
        // The full page's Kanji section: left loading, it plays no part here.
        loadKanji: () => new Promise(() => undefined),
    },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    screenSize.isMobile = true;
    current.word = word;
    current.sentences = baseSentences();
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
        current.sentences = [
            ...baseSentences(),
            ...['n3', 'n4', 'n5'].map(id => sentence({ id, original: `${id}の不思議だ。`, vocabIds: ['v-1'], matches: { 'v-1': [{ start: 3, length: 3 }] } })),
        ];
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
    });
});

describe('VocabDetailScreen, Closest synonyms', () => {
    // Two frequent words sharing the first sense's glosses: one interchangeable, one confusable.
    const synonyms = (nuance?: string): Vocabulary['synonyms'] => [
        { id: 's-1', relation: 'interchangeable', shared: ['wonder'], w: ['奇妙'], r: ['きみょう'], f: 100, ...(nuance ? { nuance } : {}) },
        { id: 's-2', relation: 'confusable', shared: ['mystery'], w: ['神秘'], r: ['しんぴ'], f: 200 },
    ];
    const section = () => [...container.querySelectorAll('section')].find(s => s.textContent.includes('Closest synonyms'));

    it('lists a pair with a nuance line as a row: the whole row its link, the line under the word', async () => {
        current.word = { ...word, synonyms: synonyms('奇妙 leans eerie, while 不思議 can be a pleasant wonder.') };
        await renderPage();
        const rows = [...(section()?.querySelectorAll('[data-list-row]') ?? [])];
        expect(rows).toHaveLength(2);
        const link = rows[0].querySelector('a');
        expect(link?.getAttribute('href')).toBe('/vocab/s-1');
        expect(link?.textContent).toContain('奇妙');
        expect(link?.textContent).toContain('while 不思議 can be a pleasant wonder');
        // No boxed tile beside the rows.
        expect(section()?.querySelector('a.border')).toBeNull();
    });

    it('keeps the boxed tiles when no pair has a nuance line', async () => {
        current.word = { ...word, synonyms: synonyms() };
        await renderPage();
        expect(section()?.querySelector('[data-list-row]')).toBeNull();
        expect(section()?.querySelectorAll('a.border')).toHaveLength(2);
    });
});
