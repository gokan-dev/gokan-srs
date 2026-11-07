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
 * `path` in the English shape the app's types describe, from the published files `englishInputs`
 * names for it (its core, its English text, the shared files it declares), each read by `read`
 * (shared ones by `readShared`), all asked for at once. The dataset keeps each file's English
 * text apart from its core (its docs/MULTILINGUAL.md); `englishFile`, its own projection, puts
 * them back together, so the app sees exactly the file it read before the published layout
 * (datasetFile.node.test.ts). When reads fail, the core's failure is the one thrown: a missing
 * file is judged on its core, whatever its text's request did.
 */
export async function englishDatasetFile(
    path: string,
    read: (input: string) => Promise<unknown>,
    readShared: (input: string) => Promise<unknown> = read,
): Promise<unknown> {
    const inputs = englishInputs(path);
    const [core, text, ...shared] = await Promise.allSettled([
        read(inputs.core),
        inputs.text === undefined ? Promise.resolve(undefined) : read(inputs.text),
        ...inputs.shared.map(readShared),
    ]);
    const valueOf = (result: PromiseSettledResult<unknown>): unknown => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    };
    const coreValue = valueOf(core);
    return englishFile(path, {
        core: coreValue,
        text: valueOf(text),
        shared: new Map(inputs.shared.map((input, index) => [input, valueOf(shared[index])])),
    });
}

/** Thrown by a read when the server says a file's core does not exist. */
class MissingDatasetFile extends Error {}

/**
 * A dataset file in its English shape (`englishDatasetFile`, over the published dataset at
 * /dataset/), or null when the dataset has no such file (`isMissing`, judged on its core). Its
 * core exists but its English text does not: an error, never "no text". Not cached here: each
 * loader keeps the file in its own `RequestCache`, so callers asking at once share one set of
 * downloads; the shared inputs are cached for the session.
 */
export async function fetchOptionalDatasetFile<T>(path: string, isMissing: (response: Response) => boolean = isMissingFile): Promise<T | null> {
    const read = async (input: string): Promise<unknown> => {
        const response = await fetch(datasetUrl(input));
        if (input === path && isMissing(response)) throw new MissingDatasetFile(path);
        return readInput(input, response);
    };
    try {
        // The dataset's schema (its docs/SCHEMA.md) is what guarantees the shape, as for readJson.
        return await englishDatasetFile(path, read, input => sharedInputs.get(input)) as T;
    } catch (error) {
        if (error instanceof MissingDatasetFile) return null;
        throw error;
    }
}

/** A dataset file in its English shape (see `fetchOptionalDatasetFile`); any failure throws, absence included. */
export async function fetchDatasetFile<T>(path: string): Promise<T> {
    const file = await fetchOptionalDatasetFile<T>(path, () => false);
    // Unreachable: nothing counts as missing above, so a missing core already threw on its status.
    if (file === null) throw new Error(`Dataset file ${path} is missing`);
    return file;
}
