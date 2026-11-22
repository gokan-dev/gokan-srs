// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppSearchResults } from '../utils/search.utils';
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
};

vi.mock('../services/search.service', () => ({ SearchService: { search: () => Promise.resolve(results) } }));
vi.mock('../hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }));
vi.mock('../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));
vi.mock('../context/useQuiz', () => ({ useQuiz: () => ({ state: { progress: userProgress() } }) }));
// A word's status is the Learn button: a control of its own.
vi.mock('./WordStudyStatus', () => ({ WordStudyStatus: () => <button type="button">Learn</button> }));

function Where() {
    return <output data-path>{useLocation().pathname}</output>;
}

async function openPanel(): Promise<{ root: ReturnType<typeof createRoot>; path: () => string }> {
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
    return { root, path: () => container.querySelector('[data-path]')?.textContent ?? '' };
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
