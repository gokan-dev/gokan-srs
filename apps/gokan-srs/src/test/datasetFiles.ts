import { vi } from 'vitest';
import { englishDatasetFile } from '../services/http';

const COMPILED = 'dataset/compiled/';

/**
 * Every core file a test globbed from the dataset checkout, in its English shape, keyed by its
 * path under compiled/: built as the app's loader builds it (`englishDatasetFile`), from the
 * published files, so a test sees what the app is served. The glob names each file's core and
 * its English text under text/en/ (`import.meta.glob('.../dataset/compiled/{vocab,text/en/vocab}/...',
 * { eager: true, import: 'default' })`: a glob, since this tsconfig has no Node types). A core
 * whose text was not globbed throws, so a test never reads a file without its English.
 */
export async function englishFiles<T>(globbed: Record<string, unknown>): Promise<Record<string, T>> {
    const byInput = new Map(Object.entries(globbed).map(([key, value]) => [key.slice(key.indexOf(COMPILED) + COMPILED.length), value]));
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

/** A file's English text with nothing in it: what a test's loader reads beside a core it made up. */
export const emptyEnglishText = (): { kind: string; lang: 'en'; entities: Record<string, never> } => ({ kind: 'vocab', lang: 'en', entities: {} });

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
