import { useEffect, useEffectEvent, useState } from 'react';

export type AsyncData<T> =
    | { status: 'idle'; data: undefined; error: undefined }
    /** `data` is the previous key's result while `keepPrevious` is set, otherwise undefined. */
    | { status: 'loading'; data: T | undefined; error: undefined }
    | { status: 'ready'; data: T; error: undefined }
    | { status: 'error'; data: undefined; error: unknown };

const IDLE = { status: 'idle', data: undefined, error: undefined } as const;

interface Options {
    /**
     * Keep showing the previous key's data while the next one loads. For a list that
     * grows in place (expanding "show all"); never for a page that changes what it is
     * about, where the previous data would be the wrong page's.
     */
    keepPrevious?: boolean;
}

/**
 * Loads data for a component: runs `load` whenever `key` changes, and returns the
 * latest result for the CURRENT key. This is the one way components fetch data, so
 * none of them re-implements the loading flag, the stale-response guard, or the
 * error path.
 *
 * `key` identifies what is being loaded (an id, or several joined). A result that
 * arrives for an older key is discarded, so navigating between two pages quickly can
 * never show the first page's data on the second. `null` means there is nothing to
 * load yet and returns `idle`.
 *
 * `load` may close over current props: it always runs with the values of the render
 * that changed the key (useEffectEvent), without being an effect dependency.
 */
export function useAsyncData<T>(key: string | null, load: () => Promise<T>, options: Options = {}): AsyncData<T> {
    const [settled, setSettled] = useState<{ key: string; result: AsyncData<T> } | null>(null);
    const runLoad = useEffectEvent(load);

    useEffect(() => {
        if (key === null) return;
        let cancelled = false;
        runLoad().then(
            data => { if (!cancelled) setSettled({ key, result: { status: 'ready', data, error: undefined } }); },
            (error: unknown) => {
                console.error(`[useAsyncData] Failed to load ${key}`, error);
                if (!cancelled) setSettled({ key, result: { status: 'error', data: undefined, error } });
            },
        );
        return () => { cancelled = true; };
    }, [key]);

    if (key === null) return IDLE;
    if (settled?.key !== key) {
        const previous = options.keepPrevious && settled?.result.status === 'ready' ? settled.result.data : undefined;
        return { status: 'loading', data: previous, error: undefined };
    }
    return settled.result;
}
