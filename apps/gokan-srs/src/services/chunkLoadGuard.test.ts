import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_COOLDOWN_MS, installChunkLoadGuard, shouldReloadForChunkError } from './chunkLoadGuard';

/** A tab: its session storage survives a reload, its listeners do not. */
function fakeTab() {
    const stored = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => { stored.set(key, value); },
    });
    let clock = 1_000_000;
    let page = new EventTarget();
    const reload = vi.fn(() => { page = new EventTarget(); load(); });
    const load = () => installChunkLoadGuard({ addEventListener: (type, listener) => page.addEventListener(type, listener), location: { reload } }, () => clock);
    load();
    return {
        reload,
        failChunk: () => page.dispatchEvent(new Event('vite:preloadError', { cancelable: true })),
        wait: (ms: number) => { clock += ms; },
    };
}

describe('shouldReloadForChunkError', () => {
    it('reloads the first time, and again only after the cooldown', () => {
        expect(shouldReloadForChunkError(undefined, 0)).toBe(true);
        expect(shouldReloadForChunkError(0, CHUNK_RELOAD_COOLDOWN_MS - 1)).toBe(false);
        expect(shouldReloadForChunkError(0, CHUNK_RELOAD_COOLDOWN_MS)).toBe(true);
    });
});

describe('installChunkLoadGuard', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('reloads exactly once when a chunk fails, never in a loop', () => {
        const tab = fakeTab();
        tab.failChunk();
        expect(tab.reload).toHaveBeenCalledTimes(1);
        // The reloaded page fails too (offline, a broken deploy): it stays put.
        tab.wait(2_000);
        tab.failChunk();
        tab.failChunk();
        expect(tab.reload).toHaveBeenCalledTimes(1);
    });

    it('reloads again for a later deploy, past the cooldown', () => {
        const tab = fakeTab();
        tab.failChunk();
        tab.wait(CHUNK_RELOAD_COOLDOWN_MS);
        tab.failChunk();
        expect(tab.reload).toHaveBeenCalledTimes(2);
    });
});
