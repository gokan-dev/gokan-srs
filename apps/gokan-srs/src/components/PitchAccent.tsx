import { Fragment } from "react";
import { pitchGraph, type PitchAccent as Accent } from "@gokan/dataset-schema";
import { pitchAccentLabel } from "../utils/pitchAccent.utils";

/**
 * A reading with one pattern drawn over it (`pitchGraph`, in em of the reading's font, so each dot
 * sits over its kana at any size): a dot per mora and a hollow one, one em past the end, for the
 * particle after the word. The text cannot wrap without leaving its dots, so a reading too long
 * for the screen is set smaller to fit it instead. Dots and lines in the reading's own ink.
 */
function ReadingWithDots({ reading, downstep }: { reading: string; downstep: number }) {
    const g = pitchGraph(reading, downstep);
    return (
        <span
            className="relative inline-block whitespace-nowrap"
            // 0.65em on the right: room for the particle's dot, centred half an em past the reading.
            // 2rem: the page's side gutters, so the reading and its particle fit the screen's width.
            style={{ paddingTop: `${g.height}em`, paddingRight: '0.65em', fontSize: `min(1em, calc((100vw - 2rem) / ${g.width}))` }}
        >
            <svg aria-hidden="true" className="absolute left-0 top-0 overflow-visible" width={`${g.width}em`} height={`${g.height}em`} viewBox={`0 0 ${g.width} ${g.height}`}>
                {g.segments.map((s, i) => (
                    <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="stroke-current" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                ))}
                {g.points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={g.radius} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className={p.particle ? 'stroke-current fill-none' : 'fill-current'} />
                ))}
            </svg>
            {/* What a play button beside it is held to (check:layout): the text's line, not the dots above it. */}
            <span lang="ja" data-pitch-reading>{reading}</span>
        </span>
    );
}

/**
 * A word's primary reading with its pitch accent drawn over it (issue 176), in place of the plain
 * reading: the most usual pattern on the reading itself, any other after a 、 as the reading again,
 * smaller. Screen readers get the reading once and the patterns in words. Never on a quiz card: in
 * a reading quiz it would hint at the answer. `usePitchAccent` says whether to draw it.
 */
export function PitchAccent({ accent, className = '' }: { accent: Accent; className?: string }) {
    const [first, ...others] = accent.downsteps;
    if (first === undefined) return null;
    return (
        <span data-pitch-accent className={`inline-flex flex-wrap items-end gap-x-1 min-w-0 ${className}`}>
            <ReadingWithDots reading={accent.reading} downstep={first} />
            {others.map(downstep => (
                <Fragment key={downstep}>
                    <span aria-hidden="true" lang="ja" className="text-tertiary">、</span>
                    {/* 0.75em: 12px in the word card (16px), the floor for any text. */}
                    <span aria-hidden="true" className="text-[0.75em]">
                        <ReadingWithDots reading={accent.reading} downstep={downstep} />
                    </span>
                </Fragment>
            ))}
            <span className="sr-only">{pitchAccentLabel(accent.downsteps)}</span>
        </span>
    );
}
