import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioIndex } from '../test/fixtures';
import { AUDIO_INDEX_SHIPPED, loadAudioIndex } from './audio.service';

// The same question vite.config.ts asks the pinned dataset, answered here without reading the file.
const shipped = Object.keys(import.meta.glob('../../dataset/compiled/index/audio.json')).length > 0;

describe('loadAudioIndex', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    function stubFetch() {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(audioIndex()))));
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    it('answers null without asking when the dataset has no index/audio.json, so a missing file is never fetched', async () => {
        const fetchMock = stubFetch();
        await expect(loadAudioIndex(false)).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reads index/audio.json once, by its versioned dataset URL, when the dataset has it', async () => {
        const fetchMock = stubFetch();
        await expect(loadAudioIndex(true)).resolves.toEqual(audioIndex());
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]).toEqual([expect.stringMatching(/^\/data\/compiled\/index\/audio\.json\?v=/), undefined]);
    });

    it('takes its default from a build flag that agrees with the pinned dataset', () => {
        expect(AUDIO_INDEX_SHIPPED).toBe(shipped);
    });
});
