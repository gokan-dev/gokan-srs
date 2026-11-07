import { vi } from 'vitest';
import { englishDatasetFile } from '../services/http';

const COMPILED = 'dataset/compiled/';

/**
 * Files a test globbed from the dataset checkout, keyed by their path under compiled/, as the
 * published dataset names them (`vocab/1.json`, `text/en/vocab/1.json`). The glob is
 * `import.meta.glob('.../dataset/compiled/{vocab,text/en/vocab}/...', { eager: true, import: 'default' })`:
 * a glob, since this tsconfig has no Node types.
 */
export function publishedFiles(globbed: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(globbed).map(([key, value]) => [key.slice(key.indexOf(COMPILED) + COMPILED.length), value]));
}

/**
 * Every core file among `files` (published files keyed by their path under compiled/, as
 * `publishedFiles` keys a glob), in its English shape, keyed by that path: built as the app's
 * loader builds it (`englishDatasetFile`), so a test sees what the app is served. A core whose
 * English text under text/en/ is not among `files` throws, so a test never reads a file without
 * its English.
 */
export async function englishFiles<T>(files: Record<string, unknown>): Promise<Record<string, T>> {
    const byInput = new Map(Object.entries(files));
    const read = (input: string): Promise<unknown> =>
        byInput.has(input) ? Promise.resolve(byInput.get(input)) : Promise.reject(new Error(`${input} was not globbed`));
    const cores = [...byInput.keys()].filter(input => !input.startsWith('text/'));
    // The checkout's own files, in the shape the dataset's schema guarantees.
    const built = await Promise.all(cores.map(async core => [core, await englishDatasetFile(core, read) as T] as const));
    return Object.fromEntries(built);
}

/** The file of the published dataset a request asks for: `/dataset/vocab/1.json?v=...` is `vocab/1.json`. */
export function datasetPathOf(input: string | URL | Request): string {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return decodeURIComponent(new URL(url, 'http://localhost').pathname.replace(/^\/dataset\//, ''));
}

/**
 * A file's English text with nothing in it, for entities of `kind` (`vocab`, `sentence`, `grammar`,
 * `conjugation`, `chapter`...: the text file's own `kind`): what a test's loader reads beside a
 * core it made up.
 */
export const emptyEnglishText = (kind: string): { kind: string; lang: 'en'; entities: Record<string, never> } => ({ kind, lang: 'en', entities: {} });

/**
 * A `fetch` answering the published dataset from `files` (paths under compiled/): a request for
 * any other file is a 404, and every request answers `status()` when it is not 200.
 */
export function publishedFetch(files: Record<string, unknown>, status = () => 200) {
    return vi.fn((url: string) => {
        const path = datasetPathOf(url);
        if (status() !== 200) return Promise.resolve(new Response('', { status: status(), statusText: 'Server Error' }));
        return Promise.resolve(Object.hasOwn(files, path)
            ? new Response(JSON.stringify(files[path]))
            : new Response('', { status: 404, statusText: 'Not Found' }));
    });
}
