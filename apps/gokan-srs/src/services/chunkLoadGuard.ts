import { readPersistedControls, writePersistedControls } from '../hooks/usePersistedControls';

const KEY = 'gokan.chunkReload';

/** Within this long of the last reload, a failed chunk is not reloaded for again. */
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

/**
 * Whether a failed chunk should reload the page: yes, unless this tab already reloaded for one
 * within the cooldown. The fresh page names the chunks that exist, so a second failure that
 * soon is not a stale tab (offline, a broken deploy) and reloading again would only loop.
 */
export function shouldReloadForChunkError(lastReloadAt: number | undefined, now: number): boolean {
    return lastReloadAt === undefined || now - lastReloadAt >= CHUNK_RELOAD_COOLDOWN_MS;
}

interface GuardTarget {
    addEventListener: (type: 'vite:preloadError', listener: () => void) => void;
    location: Pick<Location, 'reload'>;
}

/**
 * Reloads once when a lazy page fails to load. A tab left open across a deploy keeps the old
 * index.html, whose hashed chunks the deploy pruned, so its next lazy navigation fails; the
 * reloaded page revalidates index.html (`cacheControlFor`) and names the new ones. Vite fires
 * `vite:preloadError` for every failed dynamic import. The last reload's time is kept for the
 * tab's session, so it survives the reload it guards against repeating.
 */
export function installChunkLoadGuard(target: GuardTarget = window, now: () => number = Date.now): void {
    target.addEventListener('vite:preloadError', () => {
        const { at } = readPersistedControls<{ at: number }>(KEY);
        if (!shouldReloadForChunkError(typeof at === 'number' ? at : undefined, now())) return;
        writePersistedControls(KEY, { at: now() });
        target.location.reload();
    });
}
