import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveVersion } from '../models/release.model';
import { CHANGELOG } from '../../release/changelog';
import { APP_VERSION, VERSION_POLL_MIN_GAP_MS, VERSION_POLL_MS, fetchLiveVersion, loadChangelog, watchLiveVersion } from './release.service';

const LIVE: LiveVersion = { version: '9.9.0', dataset: 'abc' };

/** A document whose visibility a test flips. */
function fakePage() {
    const target = new EventTarget();
    let visibilityState: DocumentVisibilityState = 'visible';
    return {
        page: {
            addEventListener: target.addEventListener.bind(target),
            removeEventListener: target.removeEventListener.bind(target),
            get visibilityState() { return visibilityState; },
        },
        show: (state: DocumentVisibilityState) => { visibilityState = state; target.dispatchEvent(new Event('visibilitychange')); },
    };
}

function respondWith(body: unknown) {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body))));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('APP_VERSION', () => {
    it('is baked in from the newest changelog entry, never empty', () => {
        expect(APP_VERSION).toBe(CHANGELOG[0].version);
        expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
});

describe('the release files', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('reads version.json past the browser cache, through the parsing boundary', async () => {
        const fetchMock = respondWith(LIVE);
        await expect(fetchLiveVersion()).resolves.toEqual(LIVE);
        expect(fetchMock).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
    });

    it('fails on a version.json that is not one', async () => {
        respondWith({ version: 3 });
        await expect(fetchLiveVersion()).rejects.toThrow('not a version');
    });

    it('reads changelog.json through the same boundary, once', async () => {
        const fetchMock = respondWith(CHANGELOG);
        await expect(Promise.all([loadChangelog(), loadChangelog()])).resolves.toEqual([[...CHANGELOG], [...CHANGELOG]]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/changelog.json', undefined);
    });
});

describe('watchLiveVersion', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    const watch = (fetchLive = vi.fn(() => Promise.resolve(LIVE))) => {
        const { page, show } = fakePage();
        const onLive = vi.fn();
        const watcher = watchLiveVersion(onLive, { fetchLive, now: () => Date.now(), page });
        return { watcher, fetchLive, onLive, show };
    };

    it('asks on a check and hands the answer on', async () => {
        const { watcher, onLive } = watch();
        watcher.check();
        await vi.advanceTimersByTimeAsync(0);
        expect(onLive).toHaveBeenCalledWith(LIVE);
        watcher.stop();
    });

    it('asks once for a burst of checks, again after the gap and on every interval', async () => {
        const { watcher, fetchLive } = watch();
        watcher.check();
        watcher.check();
        expect(fetchLive).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(VERSION_POLL_MIN_GAP_MS);
        watcher.check();
        expect(fetchLive).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(VERSION_POLL_MS);
        expect(fetchLive).toHaveBeenCalledTimes(3);
        watcher.stop();
    });

    it('asks when the tab comes back into view, not when it leaves', async () => {
        const { watcher, fetchLive, show } = watch();
        show('hidden');
        expect(fetchLive).not.toHaveBeenCalled();
        show('visible');
        expect(fetchLive).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(0);
        watcher.stop();
    });

    it('only logs a failed ask, and stops asking once stopped', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { watcher, fetchLive, onLive, show } = watch(vi.fn(() => Promise.reject(new Error('offline'))));
        watcher.check();
        await vi.advanceTimersByTimeAsync(0);
        expect(warn).toHaveBeenCalledOnce();
        expect(onLive).not.toHaveBeenCalled();
        watcher.stop();
        await vi.advanceTimersByTimeAsync(VERSION_POLL_MS * 2);
        show('visible');
        expect(fetchLive).toHaveBeenCalledTimes(1);
    });
});
