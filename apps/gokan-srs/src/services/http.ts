import { englishFile, englishInputs } from '@gokan/dataset-schema/english-file';

/**
 * Parses a response's JSON body. The one place a response body is given a type:
 * the caller names the shape it expects, and the compiled dataset's schema (the
 * dataset repository's docs/SCHEMA.md) or the remote API is what guarantees it.
 */
export async function readJson<T>(response: Response): Promise<T> {
    const body: unknown = await response.json();
    return body as T;
}

/** Whether an untrusted value is a plain object, the first narrowing step of every parser. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
 * Whether the server says a dataset file does not exist, as opposed to a transient failure. A dev
 * server returns 404; production CloudFront's distribution-wide SPA fallback rewrites a missing
 * key to index.html at 200 (text/html). A 5xx, 403 or 429 is not absence.
 */
export function isMissingFile(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    return response.status === 404 || (response.ok && contentType.includes('text/html'));
}

async function readInput(path: string, response: Response): Promise<unknown> {
    if (!response.ok) throw new Error(`Failed to fetch ${datasetUrl(path)}: ${response.status} ${response.statusText}`);
    return readJson<unknown>(response);
}

/**
 * The small files several dataset files declare as shared inputs (the grammar slot labels, the
 * browse index's titles): each is fetched once per session and reused by every file that needs it.
 */
const sharedInputs = new RequestCache<unknown>(path => fetchJson<unknown>(datasetUrl(path)));

/**
 * A dataset file in the English shape the app's types describe, or null when the dataset has no
 * such file (`isMissing`, judged on its core). The dataset keeps each file's English text apart
 * from its core (its docs/MULTILINGUAL.md); the inputs `englishInputs` names are fetched in
 * parallel and put back together by `englishFile`, the dataset's own projection, so the app sees
 * exactly the file it read before the published layout (the equality test in
 * datasetFile.test.ts). Its core exists but its English text does not: an error, never "no text".
 * Not cached: each loader keeps the file in its own `RequestCache`, so callers asking at once
 * share one set of downloads.
 */
export async function fetchOptionalDatasetFile<T>(path: string, isMissing: (response: Response) => boolean = isMissingFile): Promise<T | null> {
    const inputs = englishInputs(path);
    const [core, text, shared] = await Promise.all([
        fetch(datasetUrl(inputs.core)),
        inputs.text === undefined ? undefined : fetch(datasetUrl(inputs.text)),
        Promise.all(inputs.shared.map(async input => [input, await sharedInputs.get(input)] as const)),
    ]);
    if (isMissing(core)) return null;
    const [coreValue, textValue] = await Promise.all([
        readInput(inputs.core, core),
        inputs.text === undefined || text === undefined ? undefined : readInput(inputs.text, text),
    ]);
    // The dataset's schema (its docs/SCHEMA.md) is what guarantees the shape, as for readJson.
    return englishFile(path, { core: coreValue, text: textValue, shared: new Map(shared) }) as T;
}

/** A dataset file in its English shape (see `fetchOptionalDatasetFile`); any failure throws, absence included. */
export async function fetchDatasetFile<T>(path: string): Promise<T> {
    const file = await fetchOptionalDatasetFile<T>(path, () => false);
    // Unreachable: nothing counts as missing above, so a missing core already threw on its status.
    if (file === null) throw new Error(`Dataset file ${path} is missing`);
    return file;
}
