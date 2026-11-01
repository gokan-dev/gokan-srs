import { loadAudioIndex } from './audio.service';
import { audioUrl } from './http';

/** What the player needs of an `HTMLAudioElement`, so a test can hand it a fake. */
export interface PlayableClip {
    play(): Promise<void>;
    pause(): void;
    addEventListener(type: 'ended' | 'error', listener: () => void): void;
}

export interface ClipPlayer {
    /** Plays `clip`, stopping any other; pressed again while it plays (or loads), stops it. Rejects only if the clip's URL cannot be built. */
    toggle(clip: string): Promise<void>;
    /** Stops `clip` if it is the one playing (its button left the page). */
    stopIf(clip: string): void;
    /** The clip playing or about to, or null. */
    playing(): string | null;
    subscribe(listener: () => void): () => void;
}

interface ClipPlayerDeps {
    /** The clip's URL; a rejection is a dataset failure the caller reports. */
    urlOf: (clip: string) => Promise<string>;
    open: (url: string) => PlayableClip;
}

/**
 * One clip plays at a time, app-wide, and only on a press: nothing is fetched before one (the
 * element is made, so the file asked for, when its button is pressed). A clip that fails to play
 * (blocked, a network error) just returns its button to rest: a missing sound is not data loss.
 */
export function createClipPlayer({ urlOf, open }: ClipPlayerDeps): ClipPlayer {
    let current: string | null = null;
    let element: PlayableClip | null = null;
    // Bumped by every start and stop, so a late URL, `ended` or failed `play()` from a clip
    // already replaced or stopped changes nothing.
    let generation = 0;
    const listeners = new Set<() => void>();
    const emit = () => { for (const listener of listeners) listener(); };

    const stop = () => {
        generation++;
        element?.pause();
        element = null;
        if (current !== null) {
            current = null;
            emit();
        }
    };

    return {
        async toggle(clip) {
            const wasPlaying = current === clip;
            stop();
            if (wasPlaying) return;
            const token = generation;
            current = clip;
            emit();
            const endIfCurrent = () => { if (token === generation) stop(); };

            let url: string;
            try {
                url = await urlOf(clip);
            } catch (error) {
                endIfCurrent();
                throw error;
            }
            if (token !== generation) return;
            const audio = open(url);
            element = audio;
            audio.addEventListener('ended', endIfCurrent);
            audio.addEventListener('error', endIfCurrent);
            try {
                await audio.play();
            } catch (error) {
                // A pause before playback began rejects too (AbortError): that clip was stopped, not broken.
                if (token !== generation) return;
                console.warn(`[clipPlayer] Could not play ${url}`, error);
                stop();
            }
        },
        stopIf(clip) {
            if (current === clip) stop();
        },
        playing: () => current,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}

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
