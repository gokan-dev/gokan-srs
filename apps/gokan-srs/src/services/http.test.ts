import { describe, it, expect, vi } from 'vitest';
import { datasetUrl, RequestCache } from './http';

describe('datasetUrl', () => {
    it('versions every dataset request with the dataset commit', () => {
        // Without the version, a browser keeps answering this URL from a cached older dataset.
        expect(datasetUrl('vocab/1002120.json')).toMatch(/^\/data\/compiled\/vocab\/1002120\.json\?v=[0-9a-f]{12}$/);
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
