// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePagedPanel, type PagedPanel } from './usePagedPanel';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
/** The hook as of the last render. */
let panel: PagedPanel;

function Probe({ pageSize, onPanel }: { pageSize: number; onPanel: (panel: PagedPanel) => void }) {
    const paged = usePagedPanel(pageSize);
    useEffect(() => onPanel(paged));
    return null;
}

beforeEach(() => {
    root = createRoot(document.createElement('div'));
    act(() => root.render(<Probe pageSize={10} onPanel={latest => { panel = latest; }} />));
});

afterEach(() => act(() => root.unmount()));

describe('usePagedPanel', () => {
    it('shows a page at first and the next page on each showMore', () => {
        expect(panel.shown()).toBe(10);
        expect(panel.more(25)).toBe(15);
        act(() => panel.showMore(25));
        expect(panel.shown()).toBe(20);
        expect(panel.more(25)).toBe(5);
    });

    it('stops showMore at the remaining count, never past the list', () => {
        act(() => panel.showMore(25));
        act(() => panel.showMore(25));
        expect(panel.shown()).toBe(25);
        expect(panel.more(25)).toBe(0);
        act(() => panel.showMore(25));
        expect(panel.shown()).toBe(25);
    });

    it('starts every list on its first page again as the learner types', () => {
        act(() => panel.showMore(40, 'built'));
        act(() => panel.showMore(40));
        expect([panel.shown('built'), panel.shown('used'), panel.shown()]).toEqual([20, 10, 20]);
        act(() => panel.setText('eat'));
        expect(panel.text).toBe('eat');
        expect(panel.query).not.toBeNull();
        expect([panel.shown('built'), panel.shown()]).toEqual([10, 10]);
    });

    it('needs a search only when a list runs past its first page', () => {
        expect(panel.searchable(10)).toBe(false);
        expect(panel.searchable(11)).toBe(true);
    });
});
