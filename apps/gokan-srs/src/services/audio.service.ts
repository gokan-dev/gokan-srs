import type { AudioIndex } from '@gokan/dataset-schema';
import { datasetUrl, fetchJson, sharedRequest } from './http';

/** Whether this build's dataset has `index/audio.json`, injected by vite.config.ts. */
declare const __AUDIO_INDEX_SHIPPED__: boolean;

const audioIndex = sharedRequest(() => fetchJson<AudioIndex>(datasetUrl('index/audio.json')));

/**
 * The voice the dataset's clips are read in, with the credit its terms require, or null when
 * the dataset has no clip yet (it writes the file with the first one). Not asked for when
 * absent: a missing dataset file answers with the app's shell, which would fail to parse.
 */
export function loadAudioIndex(): Promise<AudioIndex | null> {
    return __AUDIO_INDEX_SHIPPED__ ? audioIndex.get() : Promise.resolve(null);
}
