import type { GrammarChapterProgressCounts } from "../context/quiz/grammarSelectors";

interface ChapterProgressBarProps {
    counts: GrammarChapterProgressCounts;
    /** Compact hides the numeric breakdown text, for tight spaces like the hub card. */
    compact?: boolean;
}

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
export function ChapterProgressBar({ counts, compact }: ChapterProgressBarProps) {
    const { mastered, learning, total } = counts;
    const masteredPct = total > 0 ? (mastered / total) * 100 : 0;
    const learningPct = total > 0 ? (learning / total) * 100 : 0;
    const untouched = total - mastered - learning;

    return (
        <div className="flex items-center gap-2">
            <div className="flex h-1.5 flex-1 min-w-0 rounded-sm overflow-hidden bg-surface-hover/50">
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
