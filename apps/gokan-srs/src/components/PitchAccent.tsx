import type { ReactNode } from "react";
import { PITCH_LINE_PX, PITCH_OTHER_SCALE, pitchAccentLabel, pitchPaths, type PitchAccent as Accent } from "@gokan/dataset-schema";

/** The page's side gutters (Page.tsx's px-4, BottomSheet's p-4): what the reading fits within. */
const GUTTERS = '2rem';
/** A play button after the reading: its 44px tap box (PlayButton) and the 0.5rem before it. */
const BUTTON_ROOM = '3.25rem';

/**
 * A reading with one pattern drawn over it (`pitchPaths`, in em of the reading's font, so each dot
 * sits over its kana at any size): a dot per mora and a hollow one, one em past the end, for the
 * particle after the word. The text cannot wrap without leaving its dots, so a reading too long
 * for the screen is set smaller to fit it instead, leaving `room` for what shares its line (a play
 * button). Dots and lines in the reading's own ink; spacing and font features reset, since the
 * dots assume 1em per kana.
 */
function ReadingWithDots({ reading, downstep, room = '0px', children }: { reading: string; downstep: number; room?: string; children?: ReactNode }) {
    // The same three elements as the dictionary's (pitchPaths): one line, the dots as round caps
    // of zero-length strokes (a little wider than the particle's ring), the particle's ring.
    const p = pitchPaths(reading, downstep);
    return (
        <span
            className="relative inline-block whitespace-nowrap tracking-normal [font-feature-settings:normal]"
            // The graph's height on top, the particle's room on the right (both from pitchPaths).
            style={{ paddingTop: `${p.height}em`, paddingRight: `${p.padRight}em`, fontSize: `min(1em, calc((100vw - ${GUTTERS} - ${room}) / ${p.width}))` }}
        >
            <svg aria-hidden="true" className="absolute left-0 top-0 overflow-visible fill-none stroke-current" width={`${p.width}em`} height={`${p.height}em`} viewBox={`0 0 ${p.width} ${p.height}`}>
                <path d={p.line} strokeWidth={PITCH_LINE_PX} vectorEffect="non-scaling-stroke" />
                <path d={p.dots} strokeWidth={p.dot} strokeLinecap="round" />
                <circle cx={p.particle.cx} cy={p.particle.cy} r={p.radius} strokeWidth={PITCH_LINE_PX} vectorEffect="non-scaling-stroke" />
            </svg>
            {/* What a play button beside it is held to (check:layout): the text's line, not the dots above it. */}
            <span lang="ja" data-pitch-reading>{reading}</span>
            {children}
        </span>
    );
}

/**
 * A word's primary reading with its pitch accent drawn over it (issue 176), in place of the plain
 * reading: the most usual pattern on the reading itself, any other as the reading again, smaller
 * (never under 12px), after a gap wider than the one before a play button (`ms-2` on the row's
 * gap), so two contours never read as one line and the button reads as the first pattern's. No mark
 * between them: a later pattern that wraps would open its line with it. Screen readers get the
 * reading once and the patterns in words. A play
 * button (`play`, given an `ml-1` for the row's 0.5rem) follows the first pattern, which leaves it room on its line; a further pattern
 * follows the button, wrapping to the next line when it does not fit, so the button never drops
 * under its reading. Never on a quiz card: in a reading quiz it would hint at the answer.
 * `usePitchAccent` says whether to draw it.
 */
export function PitchAccent({ accent, play, className = '' }: { accent: Accent; play?: ReactNode; className?: string }) {
    const [first, ...others] = accent.downsteps;
    if (first === undefined) return null;
    return (
        <span data-pitch-accent className={`inline-flex flex-wrap items-end gap-x-1 min-w-0 ${className}`}>
            <ReadingWithDots reading={accent.reading} downstep={first} room={play ? BUTTON_ROOM : undefined}>
                {/* Inside the first pattern, so the button after it follows the reading itself. */}
                <span className="sr-only">{pitchAccentLabel(accent.downsteps)}</span>
            </ReadingWithDots>
            {/* Its own flex item, right after the reading (check:layout measures it from there). */}
            {play}
            {others.map(downstep => (
                <span key={downstep} aria-hidden="true" className="ms-2" style={{ fontSize: `max(0.75rem, ${PITCH_OTHER_SCALE}em)` }}>
                    <ReadingWithDots reading={accent.reading} downstep={downstep} />
                </span>
            ))}
        </span>
    );
}
