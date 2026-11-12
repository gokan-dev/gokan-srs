import { describe, expect, it } from 'vitest';
import { configuredBasePath } from './configuredBasePath';
import { BASE_PATH } from './site';

describe('BASE_PATH', () => {
    // The links (urls.ts) and SvelteKit's routes (vite.config.ts, paths.base) must agree, or every
    // page renders under one path and is served under another: both are configuredBasePath of the
    // build's VITE_BASE_PATH.
    it('is the base path SvelteKit routes under', () => {
        expect(BASE_PATH).toBe(configuredBasePath(process.env.VITE_BASE_PATH));
    });
});