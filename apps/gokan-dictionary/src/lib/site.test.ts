import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BASE_PATH } from './site';

/** The base path svelte.config.js gives SvelteKit, read as the build reads it. */
async function configuredBase(): Promise<string> {
    const url = pathToFileURL(path.resolve(import.meta.dirname, '..', '..', 'svelte.config.js')).href;
    const loaded: unknown = await import(url);
    const base = (loaded as { default?: { kit?: { paths?: { base?: unknown } } } }).default?.kit?.paths?.base;
    if (typeof base !== 'string') throw new Error('svelte.config.js sets no kit.paths.base');
    return base;
}

describe('BASE_PATH', () => {
    // svelte.config.js cannot import TypeScript, so it reads VITE_BASE_PATH itself. The links
    // (urls.ts) and SvelteKit's routes must agree, or every page renders under one path and is
    // served under another.
    it('is the base path SvelteKit routes under', async () => {
        expect(await configuredBase()).toBe(BASE_PATH);
    });
});
