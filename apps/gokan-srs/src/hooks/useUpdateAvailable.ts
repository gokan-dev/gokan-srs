import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { LiveVersion } from '../models/release.model';
import { APP_VERSION, watchLiveVersion, type VersionWatch } from '../services/release.service';
import { availableUpdate } from '../utils/changelog.utils';

/**
 * The version a newer deploy has put live, while this tab runs another and the learner has not
 * dismissed it; null otherwise. Asks on mount, on every route change, when the tab comes back
 * into view and every few minutes (`watchLiveVersion`). A dismissed version stays dismissed for
 * the tab; a later one is offered again.
 */
export function useUpdateAvailable(): { version: string | null; dismiss: () => void } {
    const [live, setLive] = useState<LiveVersion | null>(null);
    const [dismissed, setDismissed] = useState<string | null>(null);
    const watch = useRef<VersionWatch | null>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        const watcher = watchLiveVersion(setLive);
        watch.current = watcher;
        return () => watcher.stop();
    }, []);
    // Declared after the watcher's effect, so on mount it runs once the watcher exists.
    useEffect(() => { watch.current?.check(); }, [pathname]);

    const version = availableUpdate(APP_VERSION, live, dismissed);
    return { version, dismiss: () => setDismissed(version) };
}
