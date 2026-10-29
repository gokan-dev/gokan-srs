import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioIndex } from '@gokan/dataset-schema';
import { loadAudioIndex } from './audio.service';

const INDEX: AudioIndex = {
    engine: 'voicevox',
    engineVersion: '0.26.0',
    voice: '冥鳴ひまり',
    style: 'ノーマル',
    credit: 'VOICEVOX:冥鳴ひまり',
    termsUrl: 'https://meimeihimari.wixsite.com/himari/terms-of-use',
    extension: 'opus',
    contentType: 'audio/ogg',
};

// The same question vite.config.ts asks the pinned dataset, answered here without reading the file.
const shipped = Object.keys(import.meta.glob('../../dataset/compiled/index/audio.json')).length > 0;

describe('loadAudioIndex', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('asks for index/audio.json exactly when the pinned dataset has it, so a missing file is never fetched', async () => {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(INDEX))));
        vi.stubGlobal('fetch', fetchMock);

        await expect(loadAudioIndex()).resolves.toEqual(shipped ? INDEX : null);
        expect(fetchMock).toHaveBeenCalledTimes(shipped ? 1 : 0);
        if (shipped) expect(fetchMock.mock.calls[0]).toEqual([expect.stringMatching(/^\/data\/compiled\/index\/audio\.json\?v=/), undefined]);
    });
});
