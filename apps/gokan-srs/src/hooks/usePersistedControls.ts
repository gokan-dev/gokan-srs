import { useEffect, useState } from 'react';

/**
 * Session-scoped persistence for a screen's filter and sort controls, so navigating to a detail
 * page and back does not reset them.
 *
 * `sessionStorage` rather than a React context, which is what "keep my filters" usually reaches
 * for first: a context is lost on reload and would need a provider mounted above every screen
 * that uses it, while these controls are per-screen UI state that nothing else reads. Session
 * storage also survives a refresh, which a context cannot, and scopes to the tab, which is the
 * right lifetime for "the list I was just looking at".
 *
 * Read once at mount (see `usePersistedControlsSnapshot`), then written on every change. Both
 * directions swallow their errors: sessionStorage throws in private mode and when over quota,
 * and losing a filter is never worth taking a screen down for.
 */
export function readPersistedControls<T>(key: string): Partial<T> {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Partial<T>) : {};
    } catch {
        return {};
    }
}

export function writePersistedControls<T>(key: string, value: T): void {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // sessionStorage unavailable (private mode / quota). Non-fatal.
    }
}

/**
 * The snapshot to seed `useState` initialisers from, read exactly once per mount.
 *
 * A lazy `useState` rather than `useRef(read(key)).current`, which is what the two stats lists
 * previously did: a ref's argument is still evaluated on every render even though only the
 * first result is kept, so that form re-ran `getItem` and `JSON.parse` on every keystroke and
 * threw the result away. It also reads a ref during render, which the React lint rules reject.
 * The lazy initialiser runs exactly once and cannot go stale mid-session.
 */
export function usePersistedControlsSnapshot<T>(key: string): Partial<T> {
    const [snapshot] = useState(() => readPersistedControls<T>(key));
    return snapshot;
}

/** Writes `value` back to `key` whenever it changes. Pair with `usePersistedControlsSnapshot`. */
export function usePersistControls<T>(key: string, value: T, deps: React.DependencyList): void {
    useEffect(() => {
        writePersistedControls(key, value);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller supplies the control values as deps: value is rebuilt every render, so depending on it would write on every render
    }, deps);
}
