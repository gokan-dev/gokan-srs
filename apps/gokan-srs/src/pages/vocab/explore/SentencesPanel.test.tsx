// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentence } from '../../../test/fixtures';
import { SentencesPanel } from './SentencesPanel';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings: null, session: null, grammarSession: null }, actions: {} }),
}));
vi.mock('../../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));

// Three sentences, the longest first: fewer than a page, so the panel has no search.
const few = [
    sentence({ id: 's-long', original: 'とても長い文です。' }),
    sentence({ id: 's-short', original: '短い。' }),
    sentence({ id: 's-mid', original: '中くらい。' }),
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<MemoryRouter><SentencesPanel vocabId="v-1" sentences={few} /></MemoryRouter>));
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const shownOrder = () => [...container.querySelectorAll('[data-example-sentence]')].map(row => row.textContent);
const sortButton = () => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Shortest first');

describe('SentencesPanel', () => {
    it('keeps "Shortest first" on a word whose sentences fit on one page, with no search field', () => {
        expect(container.querySelector('input')).toBeNull();
        const button = sortButton();
        expect(button).toBeDefined();
        expect(shownOrder().map(text => text?.includes('長い文'))).toEqual([true, false, false]);
        act(() => button?.click());
        expect(button?.getAttribute('aria-pressed')).toBe('true');
        const order = shownOrder();
        expect(order[0]).toContain('短い');
        expect(order[2]).toContain('長い文');
    });

    it("shows only a pattern's sentences under its line, and Clear asks to lift it", () => {
        const withPatterns = [
            sentence({ id: 'p0', original: '不思議な話。', matches: { 'v-1': [{ start: 0, length: 3, pattern: 0 }] } }),
            sentence({ id: 'p1', original: '不思議に思う。', matches: { 'v-1': [{ start: 0, length: 3, pattern: 1 }] } }),
            sentence({ id: 'none', original: '不思議だ。', matches: { 'v-1': [{ start: 0, length: 3 }] } }),
        ];
        const onClear = vi.fn();
        act(() => root.render(<MemoryRouter><SentencesPanel vocabId="v-1" sentences={withPatterns} pattern={{ index: 1, text: '不思議に思う' }} onClearPattern={onClear} /></MemoryRouter>));
        expect(container.textContent).toContain('Pattern: 不思議に思う');
        expect(shownOrder()).toHaveLength(1);
        expect(shownOrder()[0]).toContain('不思議に思う。');
        const clear = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Clear');
        act(() => clear?.click());
        expect(onClear).toHaveBeenCalledOnce();
    });
});
