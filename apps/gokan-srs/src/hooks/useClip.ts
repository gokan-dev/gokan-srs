import { useEffect, useSyncExternalStore } from "react";
import type { ClipOutcome } from "@gokan/dataset-schema";
import { useQuiz } from "../context/useQuiz";
import { clipPlayer } from "../services/clipPlayer";

/** A clip's control: whether it is the one playing, and how to start it. Every play control runs on it. */
export interface ClipControl {
    playing: boolean;
    /** Plays it, or stops it while it plays (a button press). */
    toggle: () => Promise<ClipOutcome>;
    /** Plays it from its start, whatever is playing (a replay, a card that plays on show). */
    play: () => Promise<ClipOutcome>;
}

/**
 * The one player, for one clip: the playing state, a start, and the clip stopped when its control
 * leaves the page. A clip URL that cannot be built (the audio index failed) is a dataset failure,
 * App's fatal screen; a clip that cannot play is only reported (`failed`), never fatal.
 */
export function useClip(clip: string): ClipControl {
    const { actions } = useQuiz();
    const playing = useSyncExternalStore(clipPlayer.subscribe, clipPlayer.playing, clipPlayer.playing) === clip;
    // A clip does not outlive its control: leaving the page stops it.
    useEffect(() => () => clipPlayer.stopIf(clip), [clip]);

    const run = (start: (clip: string) => Promise<ClipOutcome>) => start(clip).catch((error: unknown): ClipOutcome => {
        console.error('[PlayButton] Could not build the clip URL', error);
        actions.dataLoadFailed('The audio index could not be loaded. The application data may be corrupted. Please reload or contact support.');
        return 'failed';
    });
    return { playing, toggle: () => run(c => clipPlayer.toggle(c)), play: () => run(c => clipPlayer.play(c)) };
}
