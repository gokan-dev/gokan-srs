import type { ChangelogEntry, LiveVersion } from '../models/release.model';
import { parseChangelog, parseLiveVersion } from '../utils/changelog.utils';
import { fetchJson, sharedRequest } from './http';

/** The newest changelog entry's version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

/** The version this tab runs: `1.43.0`. */
export const APP_VERSION: string = __APP_VERSION__;

const changelog = sharedRequest(async () => parseChangelog(await fetchJson<unknown>('/changelog.json')));

/** Every shipped change, newest first, as the live deploy lists it (What's new). */
export function loadChangelog(): Promise<ChangelogEntry[]> {
    return changelog.get();
}

/**
 * The version the deploy serves now. `no-store`: the point is to see past what this tab already
 * has. The CDN can still answer from its copy, up to the hour every root file is kept for
 * (`cacheControlFor` in packages/deploy), so a tab learns of a deploy within that hour.
 */
export async function fetchLiveVersion(): Promise<LiveVersion> {
    return parseLiveVersion(await fetchJson<unknown>('/version.json', { cache: 'no-store' }));
}

/** How often an open tab asks, besides when it comes back into view or changes route. */
export const VERSION_POLL_MS = 10 * 60_000;
/** The least time between two asks, so a burst of route changes or tab switches asks once. */
export const VERSION_POLL_MIN_GAP_MS = 60_000;

export interface VersionWatch {
    /** Asks now, unless it asked within `VERSION_POLL_MIN_GAP_MS`. */
    check: () => void;
    stop: () => void;
}

interface WatchOptions {
    fetchLive?: () => Promise<LiveVersion>;
    now?: () => number;
    /** Where `visibilitychange` fires: the document. */
    page?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
}

/**
 * Polls `/version.json`: every `VERSION_POLL_MS`, when the tab comes back into view and on every
 * `check` (a route change), handing each answer to `onLive`. A static site has no channel to
 * push a deploy on, and a poll of one small file is enough at this scale (docs/MODIFICATION_LOG.md).
 * A failed ask is only logged: being offline is not a reason to bother the learner.
 */
export function watchLiveVersion(onLive: (live: LiveVersion) => void, options: WatchOptions = {}): VersionWatch {
    const { fetchLive = fetchLiveVersion, now = Date.now, page = document } = options;
    let lastAskedAt = -Infinity;
    let stopped = false;

    const check = () => {
        if (stopped || now() - lastAskedAt < VERSION_POLL_MIN_GAP_MS) return;
        lastAskedAt = now();
        fetchLive().then(
            live => { if (!stopped) onLive(live); },
            (error: unknown) => console.warn('[release] Could not check for a new version', error),
        );
    };
    const onVisibility = () => { if (page.visibilityState === 'visible') check(); };

    const timer = setInterval(check, VERSION_POLL_MS);
    page.addEventListener('visibilitychange', onVisibility);
    return {
        check,
        stop: () => {
            stopped = true;
            clearInterval(timer);
            page.removeEventListener('visibilitychange', onVisibility);
        },
    };
}
