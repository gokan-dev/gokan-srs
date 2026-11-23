// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppSearchResults } from '../utils/search.utils';
import type { SearchWordRow } from '@gokan/dataset-schema';
import { userProgress } from '../test/fixtures';
import { grammarPath, kanjiPath, vocabPath } from '../utils/navigation.utils';
import { SEARCH_PAGE_SIZE, SearchBar } from './SearchBar';

const mizu: SearchWordRow = ['mizu', '水', 'みず', 'water', 5, 1];
const results: AppSearchResults = {
    query: 'sui',
    kana: 'すい',
    hits: [
        { group: 'words', level: 1, hit: { row: mizu, tier: 1 } },
        { group: 'kanji', level: 2, row: ['水', 5, 9201, 'water', 'スイ みず'] },
        { group: 'grammar', level: 5, row: ['n5-073', 'Verb やすい', '〜yasui', 'easy to do', 5] },
    ],
};

/** A broad query: many more matches than one page. */
const many: AppSearchResults = {
    query: 'su',
    kana: 'す',
    hits: Array.from({ length: SEARCH_PAGE_SIZE * 2 + 5 }, (_, i) => ({ group: 'words', level: 2, hit: { row: [`w${i}`, `語${i}`, 'す', 'word', 0, 0], tier: 4 } })),
};
/** What the mocked search returns (a test sets it before opening the panel): results, or a search still running. */
let returned: AppSearchResults | Promise<AppSearchResults> = results;

vi.mock('../services/search.service', () => ({
    SearchService: { search: () => Promise.resolve(returned) },
}));
/** The debounced query: what is typed, at once, unless a test holds it back (typing not yet paused). */
let debounce = (value: string) => value;
vi.mock('../hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => debounce(value) }));
vi.mock('../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));
vi.mock('../context/useQuiz', () => ({ useQuiz: () => ({ state: { progress: userProgress() } }) }));
// A word's status is the Learn button: a control of its own.
vi.mock('./WordStudyStatus', () => ({ WordStudyStatus: () => <button type="button">Learn</button> }));

function Where() {
    return <output data-path>{useLocation().pathname}</output>;
}

async function openPanel(): Promise<{ root: ReturnType<typeof createRoot>; path: () => string; input: HTMLInputElement }> {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<MemoryRouter initialEntries={['/vocab']}><SearchBar collapsed={false} /><Where /></MemoryRouter>));
    const input = container.querySelector('input');
    if (!input) throw new Error('no search field');
    await act(async () => {
        input.focus();
        // Through the prototype's setter, as typing does: React tracks the value set on the element itself.
        Reflect.set(HTMLInputElement.prototype, 'value', 'sui', input);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await Promise.resolve();
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    return { root, path: () => container.querySelector('[data-path]')?.textContent ?? '', input };
}

/** The status cell of the first row of a type. */
function statusOf(group: string): HTMLElement {
    const row = document.querySelector(`[role="option"][data-hit="${group}"]`);
    const cell = row?.lastElementChild;
    const target = cell?.firstElementChild ?? cell;
    if (!(target instanceof HTMLElement)) throw new Error(`no status in the ${group} row`);
    return target;
}

describe('SearchBar status cells', () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    afterEach(() => { document.body.innerHTML = ''; });

    it.each([['kanji', kanjiPath('水')], ['grammar', grammarPath('n5-073')]])('a click on a %s row\'s status opens the row', async (group, expected) => {
        const { root, path } = await openPanel();
        act(() => statusOf(group).click());
        expect(path()).toBe(expected);
        act(() => root.unmount());
    });

    it('a click on a word row\'s Learn stays on the page', async () => {
        const { root, path } = await openPanel();
        act(() => statusOf('words').click());
        expect(path()).toBe('/vocab');
        act(() => root.unmount());
    });
});

describe('SearchBar: one list', () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    afterEach(() => {
        document.body.innerHTML = '';
        returned = results;
    });

    const rows = () => [...document.querySelectorAll('#header-search-results [role="option"]')];
    const keyDown = (input: HTMLInputElement, key: string) => act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });

    it('lists every type in the matcher\'s order, each row with its type, and no group labels', async () => {
        const { root } = await openPanel();
        expect(rows().map(row => row.getAttribute('data-hit'))).toEqual(['words', 'kanji', 'grammar']);
        expect(rows().map(row => row.querySelector('[data-type-chip]')?.textContent)).toEqual(['Word', 'Kanji', 'Grammar']);
        expect(document.querySelector('#header-search-results [role="group"]')).toBeNull();
        act(() => root.unmount());
    });

    it('Enter with nothing highlighted opens the first row', async () => {
        const { root, path, input } = await openPanel();
        keyDown(input, 'Enter');
        expect(path()).toBe(vocabPath('mizu').split('#')[0]);
        act(() => root.unmount());
    });

    it('the arrow keys walk the one list across types', async () => {
        const { root, path, input } = await openPanel();
        keyDown(input, 'ArrowDown');
        keyDown(input, 'ArrowDown');
        expect(rows()[1]?.getAttribute('aria-selected')).toBe('true');
        keyDown(input, 'Enter');
        expect(path()).toBe(kanjiPath('水'));
        act(() => root.unmount());
    });

    it('draws a page at first, and the next one when scrolled near the end', async () => {
        returned = many;
        const { root } = await openPanel();
        expect(rows()).toHaveLength(SEARCH_PAGE_SIZE);
        const panel = document.getElementById('header-search-results')?.parentElement;
        if (!panel) throw new Error('no panel');
        act(() => { panel.dispatchEvent(new Event('scroll')); });
        // happy-dom lays nothing out: every height is 0, so the panel is at its end.
        expect(rows()).toHaveLength(SEARCH_PAGE_SIZE * 2);
        act(() => { panel.dispatchEvent(new Event('scroll')); });
        expect(rows()).toHaveLength(many.hits.length);
        act(() => root.unmount());
    });

    it('the arrow key past the last drawn row draws the next page and moves onto it', async () => {
        returned = many;
        const { root, input } = await openPanel();
        keyDown(input, 'ArrowUp');
        expect(rows()[SEARCH_PAGE_SIZE - 1]?.getAttribute('aria-selected')).toBe('true');
        keyDown(input, 'ArrowDown');
        expect(rows()).toHaveLength(SEARCH_PAGE_SIZE * 2);
        expect(rows()[SEARCH_PAGE_SIZE]?.getAttribute('aria-selected')).toBe('true');
        act(() => root.unmount());
    });
});

describe('SearchBar: before a search has run', () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    afterEach(() => {
        document.body.innerHTML = '';
        returned = results;
    });

    const panelText = () => document.querySelector('[aria-controls="header-search-results"]')?.closest('div.relative')?.parentElement?.textContent ?? '';

    it('says nothing is found only once the search ran, not while typing has not paused yet', async () => {
        debounce = () => '';
        const { root } = await openPanel();
        expect(panelText()).toContain('Searching…');
        expect(panelText()).not.toContain('No results found');
        act(() => root.unmount());
        debounce = value => value;
    });

    it('says it is searching while the index loads, and "No results found" only once the search ran', async () => {
        let finish: (value: AppSearchResults) => void = () => undefined;
        returned = new Promise<AppSearchResults>(resolve => { finish = resolve; });
        const { root } = await openPanel();
        expect(panelText()).toContain('Searching…');
        expect(panelText()).not.toContain('No results found');
        await act(async () => {
            finish({ query: 'sui', kana: 'すい', hits: [] });
            await Promise.resolve();
        });
        expect(panelText()).toContain('No results found');
        expect(panelText()).not.toContain('Searching…');
        act(() => root.unmount());
    });

    it('gives each row its place in the whole list, for a screen reader', async () => {
        returned = many;
        const { root } = await openPanel();
        const first = document.querySelector('#header-search-results [role="option"]');
        expect(first?.getAttribute('aria-setsize')).toBe(String(many.hits.length));
        expect(first?.getAttribute('aria-posinset')).toBe('1');
        act(() => root.unmount());
    });
});
