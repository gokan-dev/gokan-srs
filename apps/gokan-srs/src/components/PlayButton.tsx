import { useEffect, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import type { AudioRef } from "@gokan/dataset-schema";
import { useQuiz } from "../context/useQuiz";
import { clipPlayer } from "../services/clipPlayer";

interface PlayButtonProps {
    /** The item's clip; without one there is no button (never a disabled one). */
    audio: AudioRef | undefined;
    /** What it reads, for its name: "Play 不思議", "Play sentence". */
    label: string;
    className?: string;
}

/**
 * Plays a word's reading or a sentence read aloud, one clip at a time app-wide; pressed while
 * playing, it stops. Accent, since it is an action; 44px on phones, inline at the end of what it
 * reads (its margins keep the line's height). Not in quizzes: listening is an exercise there.
 */
export function PlayButton({ audio, label, className = '' }: PlayButtonProps) {
    if (!audio) return null;
    return <ClipButton clip={audio.clip} label={label} className={className} />;
}

function ClipButton({ clip, label, className }: { clip: string; label: string; className: string }) {
    const { actions } = useQuiz();
    const playing = useSyncExternalStore(clipPlayer.subscribe, clipPlayer.playing) === clip;
    // A clip does not outlive its button: leaving the page stops it.
    useEffect(() => () => clipPlayer.stopIf(clip), [clip]);

    const toggle = () => {
        clipPlayer.toggle(clip).catch((error: unknown) => {
            console.error('[PlayButton] Could not build the clip URL', error);
            actions.dataLoadFailed('The audio index could not be loaded. The application data may be corrupted. Please reload or contact support.');
        });
    };

    const Icon = playing ? Square : Volume2;
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={label}
            aria-pressed={playing}
            data-play-button
            className={`inline-flex items-center justify-center align-middle min-h-11 min-w-11 -my-2.5 md:min-h-8 md:min-w-8 md:-my-1.5 rounded-md text-accent hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer ${className}`}
        >
            <Icon size={20} aria-hidden="true" className="shrink-0" fill={playing ? 'currentColor' : 'none'} />
        </button>
    );
}
