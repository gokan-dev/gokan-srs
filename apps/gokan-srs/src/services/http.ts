import { publishedDatasetReader } from '@gokan/dataset-schema/published-dataset';

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
 * URL of a file of the published dataset, e.g. `datasetUrl('vocab/123.json')`: the dataset as it
 * is, under /dataset/ (a core file, or its English text under `text/en/`). Every dataset request
 * is built here (enforced by the conventions check); a loader asks `fetchDatasetFile` for a file
 * in its English shape, which requests its inputs through this.
 *
 * Dataset files keep their names from one dataset release to the next, so the URL carries the
 * dataset version: a new dataset is a new URL, and a browser never answers it from a cached
 * older file. Files used to be served as immutable for a year with no version, which kept an
 * entry's old JLPT level in browsers after the data changed.
 */
export function datasetUrl(path: string): string {
    return `/dataset/${path}?v=${__DATASET_VERSION__}`;
}

/**
 * URL of a word's or sentence's clip read aloud, e.g. `audioUrl('0123456789abcdef', 'opus')`,
 * the extension from `index/audio.json`. Every clip URL is built here (enforced by the
 * conventions check). A clip's name is its content key, so a changed clip is a new URL: unlike
 * a dataset file it needs no `?v=`. In dev, the server proxies `/audio/` to staging.
 */
export function audioUrl(clip: string, extension: string): string {
    return `/audio/${clip}.${extension}`;
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

/**
 * The published dataset, read through the reader both apps share (@gokan/dataset-schema's
 * publishedDatasetReader: a file built from its core, its English text and the shared files it
 * declares, absence judged on its core, the shared inputs fetched once for the session), every
 * request by `datasetUrl`. Not cached here: each loader keeps the file in its own `RequestCache`,
 * so callers asking at once share one set of downloads.
 */
const dataset = publishedDatasetReader({ url: datasetUrl });

/** A dataset file in its English shape, or null when the dataset has no such file (see `publishedDatasetReader`). */
export function fetchOptionalDatasetFile<T>(path: string): Promise<T | null> {
    return dataset.optionalFile<T>(path);
}

/** A dataset file in its English shape (see `publishedDatasetReader`); any failure throws, absence included. */
export function fetchDatasetFile<T>(path: string): Promise<T> {
    return dataset.file<T>(path);
}
