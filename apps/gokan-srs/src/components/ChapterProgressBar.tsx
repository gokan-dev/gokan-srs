import type { GrammarChapterProgressCounts } from "../context/quiz/grammarSelectors";

/** A reference tick overlaid on the bar at a fixed position, independent of the fill. */
export interface ProgressBarMark {
    /** Where along the bar, 0..1. */
    position: number;
    /** Hover text naming what the tick is, e.g. "N3 and easier: 62%". */
    label: string;
}

interface ChapterProgressBarProps {
    counts: GrammarChapterProgressCounts;
    /** Compact hides the numeric breakdown text, for tight spaces like the hub card. */
    compact?: boolean;
    /** Reference ticks over the bar (the listening pages' JLPT thresholds); none by default. */
    marks?: ProgressBarMark[];
}

const clampPercent = (ratio: number) => Math.min(100, Math.max(0, ratio * 100));

/**
 * A slim three-way bar (mastered / in-progress / untouched) for ONE chapter's
 * points - the same visual language as JlptCoverageBars' per-level rows
 * (solid accent = mastered, 35% accent = in progress), but sized for a single
 * chapter rather than a whole coverage report. Used on the Main hub's grammar
 * card and the chapter browser's per-chapter rows (issue #58).
 *
 * Deliberately a separate, smaller component rather than reusing
 * JlptCoverageBars directly here: that component's headline + legend + table
 * are sized for a dedicated stats section, not a hub card blurb or a row
 * inside a list of 151 chapters.
 */
export function ChapterProgressBar({ counts, compact, marks }: ChapterProgressBarProps) {
    const { mastered, learning, total } = counts;
    const masteredPct = total > 0 ? (mastered / total) * 100 : 0;
    const learningPct = total > 0 ? (learning / total) * 100 : 0;
    const untouched = total - mastered - learning;

    return (
        <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
                <div className="flex h-1.5 rounded-sm overflow-hidden bg-surface-hover/50">
                    {masteredPct > 0 && (
                        <div className="h-full bg-accent" style={{ width: `${masteredPct}%` }} />
                    )}
                    {learningPct > 0 && (
                        <div
                            className="h-full bg-accent opacity-35"
                            style={{ width: `${learningPct}%`, marginLeft: masteredPct > 0 ? '1px' : undefined }}
                        />
                    )}
                </div>
                {marks?.map(mark => (
                    <span
                        key={mark.label}
                        title={mark.label}
                        aria-hidden="true"
                        className="absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-secondary"
                        style={{ left: `${clampPercent(mark.position)}%`, height: 'calc(100% + 5px)' }}
                    />
                ))}
            </div>
            {!compact && (
                <span className="shrink-0 text-[11px] font-gothic text-tertiary tabular-nums">
                    {mastered}/{total}
                    {learning > 0 && <span> · {learning} learning</span>}
                    {untouched > 0 && <span> · {untouched} new</span>}
                </span>
            )}
        </div>
    );
}
