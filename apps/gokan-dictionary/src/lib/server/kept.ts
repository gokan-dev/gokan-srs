// The one memo the server's indexes are kept with: pages.ts over any source, httpData.ts over the
// published dataset. A failed load is dropped, never kept, so one failed read (a 503 on a cold
// start) costs one page a 5xx, not every page until the process restarts.

/** Built on first use, then kept: every caller shares the one promise; a load that fails is dropped, so the next caller retries it. */
export function kept<T>(load: () => Promise<T>): () => Promise<T> {
    let value: Promise<T> | null = null;
    return () => {
        if (value) return value;
        const request = load();
        value = request;
        request.catch(() => {
            if (value === request) value = null;
        });
        return request;
    };
}

/** `kept` per key: each key's value built on its first use, then kept; a load that fails is dropped for that key alone. */
export function keptBy<T>(load: (key: string) => Promise<T>): (key: string) => Promise<T> {
    const byKey = new Map<string, () => Promise<T>>();
    return key => {
        let value = byKey.get(key);
        if (value === undefined) {
            value = kept(() => load(key));
            byKey.set(key, value);
        }
        return value();
    };
}
