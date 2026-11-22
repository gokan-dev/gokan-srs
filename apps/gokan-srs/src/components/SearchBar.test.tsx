// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppSearchResults, SearchLimits } from '../utils/search.utils';
import { searchIndexEntry, userProgress } from '../test/fixtures';
import { grammarPath, kanjiPath } from '../utils/navigation.utils';
import { SearchBar } from './SearchBar';

const results: AppSearchResults = {
    query: 'sui',
    kana: 'すい',
    groups: ['words', 'kanji', 'grammar'],
    words: [{ row: searchIndexEntry({ id: 'mizu', w: '水', r: 'みず', m: 'water' }), tier: 0 }],
    kanji: [['水', 5, 9201, 'water', 'スイ みず']],
    grammar: [['n5-073', 'Verb やすい', '〜yasui', 'easy to do', 5]],
    hidden: { words: 0, kanji: 0, grammar: 0 },
};

/** The same search at the full limits, and in the dropdown with a kanji the sharing dropped. */
const full: AppSearchResults = { ...results, kanji: [...results.kanji, ['推', 8, 1200, 'infer', 'スイ お.す']] };
const shared: AppSearchResults = { ...results, hidden: { words: 0, kanji: 1, grammar: 0 } };
/** Whether the dropdown's search drops a row (a test sets it before opening the panel). */
let drops = false;

vi.mock('../services/search.service', () => ({
    SearchService: { search: (_query: string, limits: SearchLimits) => Promise.resolve(!drops ? results : limits.sharedRows === undefined ? full : shared) },
}));
vi.mock('../hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }));
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

/** The status cell of the group's first row. */
function statusOf(group: string): HTMLElement {
    const row = document.querySelector(`[aria-labelledby="header-search-group-${group}"] [role="option"]`);
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

describe('SearchBar: Show all results', () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    afterEach(() => {
        document.body.innerHTML = '';
        drops = false;
    });

    const showAll = () => [...document.querySelectorAll('[role="option"]')].find(option => option.textContent === 'Show all results');
    const kanjiShown = () => [...document.querySelectorAll('[aria-labelledby="header-search-group-kanji"] [role="option"]')].map(row => row.textContent);
    const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    it('is offered only when the dropdown dropped rows', async () => {
        const { root } = await openPanel();
        expect(showAll()).toBeUndefined();
        act(() => root.unmount());
    });

    it('shows the full lists in the same panel when picked', async () => {
        drops = true;
        const { root } = await openPanel();
        expect(kanjiShown()).toHaveLength(1);
        const option = showAll();
        if (!(option instanceof HTMLElement)) throw new Error('no Show all results');
        act(() => option.click());
        await settle();
        expect(kanjiShown()).toHaveLength(2);
        expect(showAll()).toBeUndefined();
        act(() => root.unmount());
    });

    it('is the last option for the arrow keys, and Enter on it shows the full lists', async () => {
        drops = true;
        const { root, input } = await openPanel();
        act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); });
        expect(showAll()?.getAttribute('aria-selected')).toBe('true');
        act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
        await settle();
        expect(kanjiShown()).toHaveLength(2);
        act(() => root.unmount());
    });
});
