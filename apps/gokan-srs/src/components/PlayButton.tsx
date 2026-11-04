import { useEffect, useSyncExternalStore, type ReactNode } from "react";
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
 * playing, it stops. Accent, since it is an action; 44px on phones, after the reading it plays
 * (its margins keep the line's height). Not in quizzes: listening is an exercise there.
 */
export function PlayButton({ audio, label, className = '' }: PlayButtonProps) {
    if (!audio) return null;
    return <ClipButton clip={audio.clip} label={label} className={`-my-2.5 md:-my-1.5 ${className}`} />;
}

/**
 * As wide as a play button, and empty: on a centred line it balances the button on the other side,
 * so the text stays on the card's centre axis and the button right after it. Only where the line can
 * spare the width: a word's reading on the intro (WordReading), and the intro's sentence from `md` up
 * (SentenceWithPlay `centred`); on a phone a sentence keeps it for its words.
 */
export function PlaySpacer({ className = '' }: { className?: string }) {
    return <span aria-hidden="true" className={`shrink-0 w-11 md:w-8 ${className}`} />;
}

/**
 * An example sentence with its play button beside it, at its first line: a right-hand column
 * that never wraps onto a line of its own. Its top is the line's (only the bottom margin is
 * negative on phones), which centres it on the first line of a sentence's taller line box.
 * `centred` (the intro card): from `md` up the row is as wide as the sentence and centred, a spacer
 * on its left balancing the button, so the sentence sits on the card's axis with its button right
 * after it. Below `md` the row fills the line, as without it (WordSentence says why).
 */
export function SentenceWithPlay({ audio, centred = false, children }: { audio: AudioRef | undefined; centred?: boolean; children: ReactNode }) {
    return (
        <div data-play-row className={`flex items-start gap-1 ${centred ? 'md:w-fit md:max-w-full md:mx-auto' : ''}`}>
            {centred && audio && <PlaySpacer className="hidden md:block" />}
            <div className="min-w-0 flex-1">{children}</div>
            {audio && <ClipButton clip={audio.clip} label="Play sentence" className="shrink-0 -mb-2.5 md:mb-0" />}
        </div>
    );
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
            className={`inline-flex items-center justify-center align-middle min-h-11 min-w-11 md:min-h-8 md:min-w-8 rounded-md text-accent hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent transition-colors cursor-pointer ${className}`}
        >
            <Icon size={20} aria-hidden="true" className="shrink-0" fill={playing ? 'currentColor' : 'none'} />
        </button>
    );
}
