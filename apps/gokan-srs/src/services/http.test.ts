import { afterEach, describe, it, expect, vi } from 'vitest';
import { audioUrl, datasetUrl, fetchDatasetFile, fetchOptionalDatasetFile, RequestCache } from './http';
import { datasetPathOf, englishFiles, publishedFetch } from '../test/datasetFiles';

// Two grammar points and the slot labels both declare, as published.
const raw = import.meta.glob('../../dataset/compiled/{,text/en/}grammar/{slots,points/n5-001,points/n5-002}.json', { eager: true, import: 'default' });
const published = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.slice(key.indexOf('dataset/compiled/') + 'dataset/compiled/'.length), value]));

describe('datasetUrl', () => {
    it('versions every dataset request with the dataset commit', () => {
        // Without the version, a browser keeps answering this URL from a cached older dataset.
        expect(datasetUrl('vocab/1002120.json')).toMatch(/^\/dataset\/vocab\/1002120\.json\?v=[0-9a-f]{12}$/);
    });
});

describe('audioUrl', () => {
    it('names a clip by its content key and extension, with no dataset version', () => {
        // A clip's key changes with its content, so a version would only stop browsers sharing a cached clip across datasets.
        expect(audioUrl('0123456789abcdef', 'opus')).toBe('/audio/0123456789abcdef.opus');
    });
});

describe('RequestCache', () => {
    it('shares one request between callers that ask at the same moment', async () => {
        const load = vi.fn((key: string) => Promise.resolve(`file ${key}`));
        const cache = new RequestCache(load);

        const [a, b] = await Promise.all([cache.get('x'), cache.get('x')]);

        expect(a).toBe('file x');
        expect(b).toBe('file x');
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('keeps one request per key', async () => {
        const load = vi.fn((key: string) => Promise.resolve(key));
        const cache = new RequestCache(load);

        await Promise.all([cache.get('a'), cache.get('b'), cache.get('a')]);

        expect(load).toHaveBeenCalledTimes(2);
    });

    it('drops a failed request, so the next call retries', async () => {
        const load = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce('file');
        const cache = new RequestCache<string>(load);

        await expect(cache.get('x')).rejects.toThrow('offline');
        await expect(cache.get('x')).resolves.toBe('file');
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('starts again after clear', async () => {
        const load = vi.fn(() => Promise.resolve('file'));
        const cache = new RequestCache(load);

        await cache.get('x');
        cache.clear();
        await cache.get('x');

        expect(load).toHaveBeenCalledTimes(2);
    });
});

describe('fetchDatasetFile', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('builds a file from its core, its English text and its shared inputs, each by its versioned URL', async () => {
        const fetchMock = publishedFetch(published);
        vi.stubGlobal('fetch', fetchMock);

        const point = await fetchDatasetFile<{ id: string; title: string }>('grammar/points/n5-001.json');

        expect(point).toEqual((await englishFiles(raw))['grammar/points/n5-001.json']);
        expect(point.id).toBe('n5-001');
        for (const [url] of fetchMock.mock.calls) expect(url).toMatch(/^\/dataset\/.+\.json\?v=[0-9a-f]{12}$/);
    });

    it('fetches a shared input once for every file that declares it', async () => {
        const fetchMock = publishedFetch(published);
        vi.stubGlobal('fetch', fetchMock);
        // A fresh module: the shared inputs are cached for the session, so an earlier test's would count.
        vi.resetModules();
        const { fetchDatasetFile } = await import('./http');

        await Promise.all([fetchDatasetFile('grammar/points/n5-001.json'), fetchDatasetFile('grammar/points/n5-002.json')]);
        await fetchDatasetFile('grammar/points/n5-001.json');

        const requests = fetchMock.mock.calls.map(([url]) => datasetPathOf(url));
        expect(requests.filter(path => path.endsWith('grammar/slots.json')).sort()).toEqual(['grammar/slots.json', 'text/en/grammar/slots.json']);
        expect(requests.filter(path => path === 'grammar/points/n5-001.json')).toHaveLength(2);
    });

    it('fails on a file whose core exists and whose English text does not, never reading it as no text', async () => {
        const { ['text/en/grammar/points/n5-001.json']: _text, ...withoutText } = published;
        vi.stubGlobal('fetch', publishedFetch(withoutText));

        await expect(fetchDatasetFile('grammar/points/n5-001.json')).rejects.toThrow(/text\/en\/grammar\/points\/n5-001\.json\?v=\w+: 404/);
        await expect(fetchOptionalDatasetFile('grammar/points/n5-001.json')).rejects.toThrow(/404/);
    });
});

describe('fetchOptionalDatasetFile', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('gives null when the core is missing, whatever its text request did', async () => {
        // A word whose text request fails offline must still read as absent only on its core's answer.
        vi.stubGlobal('fetch', vi.fn((url: string) => (datasetPathOf(url).startsWith('text/')
            ? Promise.reject(new TypeError('Failed to fetch'))
            : Promise.resolve(new Response('', { status: 404 })))));

        await expect(fetchOptionalDatasetFile('vocab/0000000.json')).resolves.toBeNull();
    });

    it('fails, rather than giving null, when the core fails without being missing', async () => {
        vi.stubGlobal('fetch', vi.fn((url: string) => (datasetPathOf(url).startsWith('text/')
            ? Promise.resolve(new Response('', { status: 404 }))
            : Promise.resolve(new Response('', { status: 503, statusText: 'Service Unavailable' })))));

        await expect(fetchOptionalDatasetFile('vocab/0000000.json')).rejects.toThrow(/vocab\/0000000\.json\?v=\w+: 503/);
    });
});
