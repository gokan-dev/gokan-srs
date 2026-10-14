/**
 * Parses a response's JSON body. The one place a response body is given a type:
 * the caller names the shape it expects, and the compiled dataset's schema (the
 * dataset repository's docs/SCHEMA.md) or the remote API is what guarantees it.
 */
export async function readJson<T>(response: Response): Promise<T> {
    const body: unknown = await response.json();
    return body as T;
}

/** The dataset submodule's commit, injected by vite.config.ts. */
declare const __DATASET_VERSION__: string;

/**
 * URL of a compiled dataset file, e.g. `datasetUrl('vocab/123.json')`. Every dataset request is
 * built here (enforced by the conventions check).
 *
 * Dataset files keep their names from one dataset release to the next, so the URL carries the
 * dataset version: a new dataset is a new URL, and a browser never answers it from a cached
 * older file. Files used to be served as immutable for a year with no version, which kept an
 * entry's old JLPT level in browsers after the data changed.
 */
export function datasetUrl(path: string): string {
    return `/data/compiled/${path}?v=${__DATASET_VERSION__}`;
}

/**
 * Fetches a URL and parses its JSON body, failing on a non-2xx status. Every
 * service loads JSON through this rather than keeping its own copy.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return readJson<T>(response);
}

/**
 * Loads keyed by a string (a file's id), each started at most once. It holds the request, not
 * only its result: callers that ask at the same moment share one download, where caching the
 * parsed value after `await` let each of them start its own (the frequency index was fetched
 * twice per page load). A load that fails is dropped, so a later call retries; what a failure
 * means to the caller (null, {}, a throw) stays the loader's decision.
 */
export class RequestCache<T> {
    private readonly requests = new Map<string, Promise<T>>();
    private readonly load: (key: string) => Promise<T>;

    constructor(load: (key: string) => Promise<T>) {
        this.load = load;
    }

    get(key: string): Promise<T> {
        const cached = this.requests.get(key);
        if (cached) return cached;
        const request = this.load(key);
        this.requests.set(key, request);
        request.catch(() => {
            if (this.requests.get(key) === request) this.requests.delete(key);
        });
        return request;
    }

    clear(): void {
        this.requests.clear();
    }
}

/** A RequestCache for one file: `sharedRequest(() => fetchJson(...)).get()`. */
export function sharedRequest<T>(load: () => Promise<T>): { get: () => Promise<T>; clear: () => void } {
    const cache = new RequestCache<T>(load);
    return { get: () => cache.get(''), clear: () => cache.clear() };
}
