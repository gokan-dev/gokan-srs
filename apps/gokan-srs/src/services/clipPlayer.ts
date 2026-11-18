import { audioUrl, createClipPlayer, type ClipPlayer } from '@gokan/dataset-schema';
import { loadAudioIndex } from './audio.service';

/**
 * A clip's URL needs `index/audio.json`'s extension, so the index failing to load, or being
 * absent while an item lists a clip, is a dataset failure: fatal, as every other one is
 * (docs/ARCHITECTURE.md, Audio). About's credit is lenient about the same file; the player is not.
 */
export async function clipUrl(clip: string): Promise<string> {
    const index = await loadAudioIndex();
    if (!index) throw new Error(`Clip ${clip} is listed, but the dataset has no index/audio.json`);
    return audioUrl(clip, index.extension);
}

/** The app's one player. */
export const clipPlayer: ClipPlayer = createClipPlayer({ urlOf: clipUrl, open: url => new Audio(url) });
