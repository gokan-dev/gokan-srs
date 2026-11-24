// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SearchWordRow } from '@gokan/dataset-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readExploreQuery } from '../../utils/exploreSearch.utils';
import { SEARCHING, SEARCH_UNAVAILABLE } from '../../utils/search.utils';
import { useIndexSearch } from './useIndexSearch';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const wordRows = vi.fn<() => Promise<ReadonlyMap<string, SearchWordRow>>>();
vi.mock('../../services/search.service', () => ({ SearchService: { wordRows: () => wordRows() } }));

let root: Root;
let latest: ReturnType<typeof useIndexSearch>;

function Probe({ text }: { text: string }) {
    const search = useIndexSearch(readExploreQuery(text));
    useEffect(() => { latest = search; });
    return null;
}

async function render(text: string) {
    await act(async () => { root.render(<Probe text={text} />); await Promise.resolve(); });
}

beforeEach(() => { root = createRoot(document.createElement('div')); });
afterEach(() => { act(() => root.unmount()); wordRows.mockReset(); });

describe('useIndexSearch', () => {
    it('says Searching… while the rows load, then keeps the ids whose row matches', async () => {
        let resolve: (rows: ReadonlyMap<string, SearchWordRow>) => void = () => {};
        wordRows.mockReturnValue(new Promise(done => { resolve = done; }));
        await render('water');
        expect(latest.notice).toBe(SEARCHING);
        expect(latest.keep(['1', '2'])).toEqual(['1', '2']);
        const rows = new Map<string, SearchWordRow>([['1', ['1', '水', 'みず', 'water', 5, 0]], ['2', ['2', '火', 'ひ', 'fire', 5, 0]]]);
        await act(async () => { resolve(rows); await Promise.resolve(); });
        expect(latest.notice).toBeNull();
        expect(latest.keep(['1', '2'])).toEqual(['1']);
    });

    it('says search is unavailable, never Searching… for good, when the rows fail to load, and keeps every id', async () => {
        wordRows.mockRejectedValue(new Error('offline'));
        await render('water');
        await act(async () => { await Promise.resolve(); });
        expect(latest.notice).toBe(SEARCH_UNAVAILABLE);
        expect(latest.keep(['1', '2'])).toEqual(['1', '2']);
    });

    it('says nothing without a query', async () => {
        await render('');
        expect(latest.notice).toBeNull();
        expect(wordRows).not.toHaveBeenCalled();
    });
});
