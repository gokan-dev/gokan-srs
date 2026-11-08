// Reading the published dataset over HTTP (the files under /dataset/, gokan-srs#203): one file in
// its English shape, from the inputs `englishInputs` names for it. Both apps read through this:
// gokan-srs in the browser (its services/http.ts), the dictionary on its server for a page
// rendered on request. Each passes the URL builder that adds its own version and origin, so the
// algorithm (what is absent, which failure is reported, the shared inputs fetched once) is the
// same for both. Runs in a browser: no `node:` import.

import { englishFile, englishInputs } from './englishFile';

/**
 * Whether the server says a dataset file does not exist, as opposed to a transient failure. A dev
 * server returns 404; production CloudFront's distribution-wide SPA fallback rewrites a missing
 * key to index.html at 200 (text/html). A 5xx, 403 or 429 is not absence.
 */
export function isMissingFile(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    return response.status === 404 || (response.ok && contentType.includes('text/html'));
}

/**
 * `path` in the English shape the apps' types describe, from the published files `englishInputs`
 * names for it (its core, its English text, the shared files it declares), each read by `read`
 * (shared ones by `readShared`), all asked for at once. The dataset keeps each file's English
 * text apart from its core (its docs/MULTILINGUAL.md); `englishFile`, its own projection, puts
 * them back together, so a reader sees exactly the file the English view gives. When reads fail,
 * the core's failure is the one thrown: a missing file is judged on its core, whatever its text's
 * request did.
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

export interface PublishedDatasetReader {
    /** A dataset file in its English shape; any failure throws, absence included. */
    file<T>(path: string): Promise<T>;
    /**
     * A dataset file in its English shape, or null when the dataset has no such file
     * (`isMissingFile`, judged on its core). Its core exists but its English text does not: an
     * error, never "no text".
     */
    optionalFile<T>(path: string): Promise<T | null>;
}

/**
 * A reader of the published dataset. `url` builds every request's URL (the app's own: its
 * version, its origin); `fetch` defaults to the global one. Files are not cached here: a caller
 * keeps what it reads in its own cache. The shared inputs (the grammar slot labels, the browse
 * index's titles) are fetched once per reader and reused by every file that needs them; one that
 * fails is dropped, so a later file retries it.
 */
export function publishedDatasetReader({ url, fetch: fetchFile = input => fetch(input) }: {
    url: (path: string) => string;
    fetch?: (input: string) => Promise<Response>;
}): PublishedDatasetReader {
    const readInput = async (path: string, response: Response): Promise<unknown> => {
        if (!response.ok) throw new Error(`Failed to fetch ${url(path)}: ${response.status} ${response.statusText}`);
        // The dataset's schema (its docs/SCHEMA.md) is what guarantees the shape.
        const body: unknown = await response.json();
        return body;
    };

    const shared = new Map<string, Promise<unknown>>();
    const readShared = (path: string): Promise<unknown> => {
        const cached = shared.get(path);
        if (cached) return cached;
        const request = fetchFile(url(path)).then(response => readInput(path, response));
        shared.set(path, request);
        request.catch(() => {
            if (shared.get(path) === request) shared.delete(path);
        });
        return request;
    };

    async function load<T>(path: string, options: { allowMissing: true }): Promise<T | null>;
    async function load<T>(path: string, options: { allowMissing: false }): Promise<T>;
    async function load<T>(path: string, { allowMissing }: { allowMissing: boolean }): Promise<T | null> {
        const read = async (input: string): Promise<unknown> => {
            const response = await fetchFile(url(input));
            if (allowMissing && input === path && isMissingFile(response)) throw new MissingDatasetFile(path);
            return readInput(input, response);
        };
        try {
            return await englishDatasetFile(path, read, readShared) as T;
        } catch (error) {
            if (error instanceof MissingDatasetFile) return null;
            throw error;
        }
    }

    return {
        file: <T>(path: string) => load<T>(path, { allowMissing: false }),
        optionalFile: <T>(path: string) => load<T>(path, { allowMissing: true }),
    };
}
