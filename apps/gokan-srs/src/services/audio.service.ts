import type { AudioIndex } from '@gokan/dataset-schema';
import { datasetUrl, fetchJson, sharedRequest } from './http';

/** Whether this build's dataset has `index/audio.json`, injected by vite.config.ts. */
declare const __AUDIO_INDEX_SHIPPED__: boolean;

/** The build's own answer, exported so a test can check it against the pinned dataset. */
export const AUDIO_INDEX_SHIPPED: boolean = __AUDIO_INDEX_SHIPPED__;

const audioIndex = sharedRequest(() => fetchJson<AudioIndex>(datasetUrl('index/audio.json')));

/**
 * The voice the dataset's clips are read in, with the credit its terms require, or null when
 * the dataset has no clip yet (it writes the file with the first one). Not asked for when
 * absent: a missing dataset file answers with the app's shell, which would fail to parse.
 * `shipped` is a parameter so both branches are tested whatever the pointer holds.
 */
export function loadAudioIndex(shipped: boolean = AUDIO_INDEX_SHIPPED): Promise<AudioIndex | null> {
    return shipped ? audioIndex.get() : Promise.resolve(null);
}
