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
