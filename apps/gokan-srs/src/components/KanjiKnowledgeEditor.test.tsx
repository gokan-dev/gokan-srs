// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KanjiFormContextValue } from '../context/KanjiForm/KanjiFormContext';
import { SetupScreen } from '../pages/setup/SetupScreen';
import { KanjiKnowledgeEditor } from './KanjiKnowledgeEditor';

const ALL_KANJI = ['一', '二', '三', '四', '五', '六'];

const form: KanjiFormContextValue = {
    state: {
        allKanji: ALL_KANJI,
        kanjiCount: 2,
        knownPrefix: 2,
        knownKanji: new Set(['一', '二']),
        kanjiMethod: 'kklc',
        loading: false,
    },
    setKanjiCount: () => undefined,
    toggleKanji: () => undefined,
    setKanjiMethod: () => undefined,
    resetKanji: () => undefined,
};

vi.mock('../context/KanjiForm/useKanjiForm', () => ({ useKanjiForm: () => form }));
vi.mock('../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));

const tileCount = (html: string) => (html.match(/data-kanji-pos=/g) ?? []).length;
const knownLines = (html: string) => (html.match(/Known: |order known/g) ?? []).length;

describe('KanjiKnowledgeEditor', () => {
    it('on the profile page, shows the grid open with the stepper in its toolbar', () => {
        const html = renderToStaticMarkup(<KanjiKnowledgeEditor />);
        expect(tileCount(html)).toBe(ALL_KANJI.length);
        expect(html).not.toContain('Mark individual kanji');
        expect(html.indexOf('id="kanji-count"')).toBeLessThan(html.indexOf('type="search"'));
        expect(html).toContain('Known: ');
    });

    it('on setup, shows the stepper and what the count means, with the grid closed', () => {
        const html = renderToStaticMarkup(<KanjiKnowledgeEditor collapseGrid beforeGrid={<p>between</p>} />);
        expect(tileCount(html)).toBe(0);
        expect(html).toContain('id="kanji-count"');
        expect(html).toContain('2 of 6 in KKLC order known');
        expect(knownLines(html)).toBe(1);
        expect(html).not.toContain('Done marking');
        expect(html).toMatch(/aria-expanded="false"[^>]*>.*Mark individual kanji/);
        expect(html.indexOf('between')).toBeLessThan(html.indexOf('Mark individual kanji'));
    });
});

describe('KanjiKnowledgeEditor revealCount', () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

    // Not only setup's collapsed grid: any caller asking for the count gets it scrolled to.
    it.each([{ collapseGrid: false }, { collapseGrid: true }])('scrolls the count into view once the list is in (%o)', ({ collapseGrid }) => {
        const scrolled = vi.fn();
        vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrolled);
        const container = document.createElement('div');
        document.body.append(container);
        const root = createRoot(container);
        act(() => root.render(<KanjiKnowledgeEditor revealCount collapseGrid={collapseGrid} />));
        act(() => root.render(<KanjiKnowledgeEditor revealCount collapseGrid={collapseGrid} />));
        expect(scrolled).toHaveBeenCalledTimes(1);
        act(() => root.unmount());
    });
});

describe('SetupScreen', () => {
    it('puts the decisions first: method, count, vocabulary order, Start learning, then the grid', () => {
        const html = renderToStaticMarkup(<SetupScreen onComplete={() => undefined} />);
        const order = ['Kanji learning method', 'id="kanji-count"', 'Vocabulary order', 'Start learning', 'Mark individual kanji'];
        const positions = order.map(text => html.indexOf(text));
        expect(positions.every(position => position >= 0)).toBe(true);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
        expect(tileCount(html)).toBe(0);
    });
});
