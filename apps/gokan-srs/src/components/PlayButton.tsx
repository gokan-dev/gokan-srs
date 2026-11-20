import type { ReactNode } from "react";
import { Square, Volume2 } from "lucide-react";
import type { AudioRef, ClipOutcome } from "@gokan/dataset-schema";
import { useClip, type ClipControl } from "../hooks/useClip";
import { buttonClassName } from "./ui/buttonStyles";

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
 * (its margins keep the line's height). Not in quizzes: listening is an exercise there (the
 * listening cloze's own control is a `PlayControl`).
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
 * `centred` (the intro card): the row is as wide as the sentence (never wider than the line, so a
 * long one still wraps over the whole line) and centred, so the button sits right after a short
 * sentence at every width. From `md` up a spacer on its left balances the button, so the sentence
 * sits on the card's axis; below `md` there is none, and the sentence sits half a button left of it
 * (WordSentence says why).
 */
export function SentenceWithPlay({ audio, centred = false, children }: { audio: AudioRef | undefined; centred?: boolean; children: ReactNode }) {
    return (
        <div data-play-row className={`flex items-start gap-1 ${centred ? 'w-fit max-w-full mx-auto' : ''}`}>
            {centred && audio && <PlaySpacer className="hidden md:block" />}
            <div className="min-w-0 flex-1">{children}</div>
            {audio && <ClipButton clip={audio.clip} label="Play sentence" className="shrink-0 -mb-2.5 md:mb-0" />}
        </div>
    );
}

function ClipButton({ clip, label, className }: { clip: string; label: string; className: string }) {
    const { playing, toggle } = useClip(clip);
    const Icon = playing ? Square : Volume2;
    return (
        <button
            type="button"
            onClick={() => void toggle()}
            aria-label={label}
            aria-pressed={playing}
            data-play-button
            className={`inline-flex items-center justify-center align-middle min-h-11 min-w-11 md:min-h-8 md:min-w-8 rounded-md text-accent hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent transition-colors cursor-pointer ${className}`}
        >
            <Icon size={20} aria-hidden="true" className="shrink-0" fill={playing ? 'currentColor' : 'none'} />
        </button>
    );
}

/** The play control's words: "Play" until the clip has been heard once, "Play again" after. */
const PLAY_LABEL = 'Play';
const REPLAY_LABEL = 'Play again';

/**
 * A play control that stands on its own, with its words: the listening cloze's, and any place a
 * clip is the subject rather than a line's companion. A secondary `Button` (44px tall at every
 * width), the speaker in accent (a filled stop square while it plays) before its text. Its words
 * never say "Stop": they read "Play" until the clip has been heard (`heard`, an outcome `played`
 * seen), then "Play again"; whether it is playing is told only by the icon and `aria-pressed`, so
 * its accessible name and its state never contradict. It is as wide as its longest words, so it
 * never moves as they change. A press replays the clip from its start, or stops it while it
 * plays. `shortcut` names a key that does the same, for `aria-keyshortcuts` and its title. Its
 * host places it.
 */
export function PlayControl({ control, heard, shortcut, onOutcome }: {
    control: ClipControl;
    /** True once the clip has played at least once: the words become "Play again". */
    heard: boolean;
    shortcut?: string;
    /** Told how a press's start ended: a clip that cannot play has its card fall back. */
    onOutcome?: (outcome: ClipOutcome) => void;
}) {
    const { playing } = control;
    const Icon = playing ? Square : Volume2;
    const label = heard ? REPLAY_LABEL : PLAY_LABEL;
    return (
        <button
            type="button"
            onClick={() => void control.toggle().then(outcome => onOutcome?.(outcome))}
            aria-pressed={playing}
            aria-keyshortcuts={shortcut}
            title={shortcut ? `${label} (${shortcut})` : undefined}
            data-play-control
            className={buttonClassName('secondary', 'md', 'inline-flex gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent')}
        >
            <Icon size={20} aria-hidden="true" className="shrink-0 text-accent" fill={playing ? 'currentColor' : 'none'} />
            {/* The longest words, unseen, hold the width (left out of the accessible name: hidden). */}
            <span className="grid text-left">
                <span className="col-start-1 row-start-1">{label}</span>
                <span aria-hidden="true" className="invisible col-start-1 row-start-1">{REPLAY_LABEL}</span>
            </span>
        </button>
    );
}
