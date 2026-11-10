import { describe, expect, it, vi } from 'vitest';
import { kept, keptBy } from './kept';

describe('kept', () => {
    it('shares one load between callers asking at once, and keeps it', async () => {
        const load = vi.fn(() => Promise.resolve(42));
        const value = kept(load);
        expect(await Promise.all([value(), value()])).toEqual([42, 42]);
        expect(await value()).toBe(42);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('drops a load that fails, so the next caller retries it', async () => {
        const load = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce('index');
        const value = kept<string>(load);
        await expect(value()).rejects.toThrow('503');
        expect(await value()).toBe('index');
        expect(load).toHaveBeenCalledTimes(2);
    });
});

describe('keptBy', () => {
    it('loads each key once, and retries only the key whose load failed', async () => {
        const load = vi.fn((key: string) => (key === 'bad' && load.mock.calls.filter(([called]) => called === 'bad').length === 1 ? Promise.reject(new Error('503')) : Promise.resolve(key.length)));
        const value = keptBy(load);
        expect(await Promise.all([value('one'), value('one'), value('three')])).toEqual([3, 3, 5]);
        await expect(value('bad')).rejects.toThrow('503');
        expect(await value('bad')).toBe(3);
        expect(await value('one')).toBe(3);
        expect(load.mock.calls.map(([key]) => key)).toEqual(['one', 'three', 'bad', 'bad']);
    });
});
