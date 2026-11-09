import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { englishView } from './englishView.server';
import { isMissingFile, publishedDatasetReader } from './publishedDataset';

// The published files are the checkout's compiled/ (core plus text/en/), served by a fake fetch.
const COMPILED = fileURLToPath(new URL('../../../apps/gokan-srs/dataset/compiled/', import.meta.url));
const PREFIX = 'https://example.test/dataset/';
const url = (path: string) => `${PREFIX}${path}?v=test`;
const pathOf = (requested: string) => requested.slice(PREFIX.length, requested.indexOf('?'));

function checkoutFetch(fail: (path: string) => Response | null = () => null) {
    return vi.fn((requested: string) => {
        const path = pathOf(requested);
        const failure = fail(path);
        if (failure) return Promise.resolve(failure);
        try {
            return Promise.resolve(new Response(readFileSync(join(COMPILED, path)), { headers: { 'content-type': 'application/json' } }));
        } catch {
            return Promise.resolve(new Response('', { status: 404, statusText: 'Not Found' }));
        }
    });
}

describe('isMissingFile', () => {
    it('is a 404, or the SPA fallback\'s HTML at 200, and never a failure', () => {
        expect(isMissingFile(new Response('', { status: 404 }))).toBe(true);
        expect(isMissingFile(new Response('<!doctype html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }))).toBe(true);
        expect(isMissingFile(new Response('{}', { headers: { 'content-type': 'application/json' } }))).toBe(false);
        expect(isMissingFile(new Response('', { status: 503 }))).toBe(false);
        expect(isMissingFile(new Response('', { status: 403 }))).toBe(false);
    });
});

describe('publishedDatasetReader', () => {
    const view = englishView(COMPILED);

    it('builds a file as the English view has it, every request by the URL it is given', async () => {
        const fetch = checkoutFetch();
        const reader = publishedDatasetReader({ url, fetch });
        for (const path of ['vocab/1358280.json', 'grammar/points/n5-001.json', 'kanji.json']) {
            expect(await reader.file(path), path).toEqual(view.json(path));
        }
        for (const [requested] of fetch.mock.calls) expect(requested).toMatch(/^https:\/\/example\.test\/dataset\/.+\?v=test$/);
    });

    it('fetches a shared input once for every file that declares it', async () => {
        const fetch = checkoutFetch();
        const reader = publishedDatasetReader({ url, fetch });
        await Promise.all([reader.file('grammar/points/n5-001.json'), reader.file('grammar/points/n5-002.json')]);
        const slots = fetch.mock.calls.map(([requested]) => pathOf(requested)).filter(path => path.endsWith('grammar/slots.json'));
        expect(slots.sort()).toEqual(['grammar/slots.json', 'text/en/grammar/slots.json']);
    });

    it('gives null for a file whose core is missing, and fails on a core that exists without its text', async () => {
        const reader = publishedDatasetReader({ url, fetch: checkoutFetch() });
        await expect(reader.optionalFile('vocab/0000000.json')).resolves.toBeNull();
        await expect(reader.file('vocab/0000000.json')).rejects.toThrow(/vocab\/0000000\.json\?v=test: 404/);

        const withoutText = publishedDatasetReader({ url, fetch: checkoutFetch(path => (path.startsWith('text/') ? new Response('', { status: 404, statusText: 'Not Found' }) : null)) });
        await expect(withoutText.optionalFile('vocab/1358280.json')).rejects.toThrow(/text\/en\/vocab\/1358280\.json\?v=test: 404/);
    });

    it('fails, rather than giving null, on a core that fails without being missing', async () => {
        const reader = publishedDatasetReader({ url, fetch: checkoutFetch(path => (path.startsWith('text/') ? null : new Response('', { status: 503, statusText: 'Service Unavailable' }))) });
        await expect(reader.optionalFile('vocab/1358280.json')).rejects.toThrow(/503/);
    });

    it('reads a published file as it is, failing when it is not published', async () => {
        const reader = publishedDatasetReader({ url, fetch: checkoutFetch() });
        const path = 'text/zh-hans/index/entities.json';
        expect(await reader.publishedFile(path)).toEqual(JSON.parse(readFileSync(join(COMPILED, path), 'utf8')));
        await expect(reader.publishedFile('text/zh-hans/vocab/0000000.json')).rejects.toThrow(/0000000\.json\?v=test: not published \(404\)/);
        const fallback = publishedDatasetReader({ url, fetch: () => Promise.resolve(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })) });
        await expect(fallback.publishedFile(path)).rejects.toThrow(/not published \(200\)/);
    });
});
