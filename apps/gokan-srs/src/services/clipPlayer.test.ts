import { describe, expect, it, vi } from 'vitest';
import { audioIndex } from '../test/fixtures';
import type { AudioIndex } from '@gokan/dataset-schema';
import { clipUrl } from './clipPlayer';

const loadAudioIndex = vi.hoisted(() => vi.fn<() => Promise<AudioIndex | null>>());
vi.mock('./audio.service', () => ({ loadAudioIndex }));

describe('clipUrl', () => {
    it('names the clip with the extension index/audio.json gives', async () => {
        loadAudioIndex.mockResolvedValue(audioIndex({ extension: 'opus' }));
        await expect(clipUrl('0123456789abcdef')).resolves.toBe('/audio/0123456789abcdef.opus');
    });

    it('fails when an item lists a clip but the dataset has no index/audio.json', async () => {
        loadAudioIndex.mockResolvedValue(null);
        await expect(clipUrl('0123456789abcdef')).rejects.toThrow(/no index\/audio\.json/);
    });

    it('fails when index/audio.json fails to load', async () => {
        loadAudioIndex.mockRejectedValue(new Error('Failed to fetch'));
        await expect(clipUrl('0123456789abcdef')).rejects.toThrow('Failed to fetch');
    });
});
