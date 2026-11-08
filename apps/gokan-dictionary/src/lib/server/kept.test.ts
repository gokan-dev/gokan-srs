import { describe, expect, it, vi } from 'vitest';
import { kept } from './kept';

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
