// The one-clip-at-a-time player both apps run their play buttons on: the app's PlayButton
// (services/clipPlayer.ts in gokan-srs) and the dictionary's script (client/player.ts). Pure, its
// element and its URLs handed in, so a test (or a page with no network) drives it.

/** What the player needs of an `HTMLAudioElement`, so a test can hand it a fake. */
export interface PlayableClip {
    play(): Promise<void>;
    pause(): void;
    addEventListener(type: 'ended' | 'error', listener: () => void): void;
}

/**
 * How a start ended: `played` (playback began), `stopped` (stopped or replaced first, or a press
 * that stopped it), `blocked` (the browser refused to play without a press: autoplay), `failed`
 * (the clip could not play: a network or decoding error).
 */
export type ClipOutcome = 'played' | 'stopped' | 'blocked' | 'failed';

export interface ClipPlayer {
    /** Plays `clip`, stopping any other; pressed again while it plays (or loads), stops it. Rejects only if the clip's URL cannot be built. */
    toggle: (clip: string) => Promise<ClipOutcome>;
    /** Plays `clip` from its start, stopping any other, even the same one (a replay). Rejects only if the clip's URL cannot be built. */
    play: (clip: string) => Promise<ClipOutcome>;
    /** Stops `clip` if it is the one playing (its button left the page). */
    stopIf: (clip: string) => void;
    /** The clip playing or about to, or null. */
    playing: () => string | null;
    subscribe: (listener: () => void) => () => void;
}

interface ClipPlayerDeps {
    /** The clip's URL; a rejection is a dataset failure the caller reports. */
    urlOf: (clip: string) => Promise<string>;
    open: (url: string) => PlayableClip;
}

/**
 * One clip plays at a time (in the app, on a page of the dictionary), and only on a press: nothing is fetched before one (the
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

    const play = async (clip: string): Promise<ClipOutcome> => {
        stop();
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
        if (token !== generation) return 'stopped';
        const audio = open(url);
        element = audio;
        audio.addEventListener('ended', endIfCurrent);
        audio.addEventListener('error', endIfCurrent);
        try {
            await audio.play();
            return token === generation ? 'played' : 'stopped';
        } catch (error) {
            // A pause before playback began rejects too (AbortError): that clip was stopped, not broken.
            if (token !== generation) return 'stopped';
            console.warn(`[clipPlayer] Could not play ${url}`, error);
            stop();
            return error instanceof Error && error.name === 'NotAllowedError' ? 'blocked' : 'failed';
        }
    };

    return {
        async toggle(clip) {
            if (current === clip) {
                stop();
                return 'stopped';
            }
            return play(clip);
        },
        play,
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
