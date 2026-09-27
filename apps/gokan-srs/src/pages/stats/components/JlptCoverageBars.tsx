import { useState } from "react";

/**
 * One row of a coverage chart. `key` is the stable React/hover key (a JLPT
 * level number, or a chapter id string); `label` is the short text shown next
 * to the bar (e.g. "N5", or a chapter's own short title).
 */
export interface JlptLevelRow {
    key: string | number;
    label: string;
    mastered: number;
    learning: number;
    total: number;
}

interface JlptCoverageBarsProps {
    rows: JlptLevelRow[];
    /** What each counted item is, for the headline copy - e.g. "vocabulary", "grammar points". */
    itemLabel: string;
    /** Full headline, e.g. "JLPT vocabulary covered". Defaults to "JLPT {itemLabel} covered" for the two original JLPT-level callers. */
    headline?: string;
    /** Header of the leftmost `<details>` table column, and the row-label column's semantic role. Defaults to "Level". */
    keyColumnLabel?: string;
    /**
     * Past this many rows, the bar list scrolls in a fixed-height pane instead
     * of growing the page - a 5-row JLPT chart never needs it, but a 150-row
     * chapter chart would otherwise push the rest of the Stats page far down.
     */
    maxVisibleRows?: number;
}

/**
 * Shared rendering for a per-row coverage chart: headline + legend, stacked
 * bars, and a `<details>` table. Used by `JlptCoverageChart` (vocabulary),
 * `GrammarJlptCoverageChart`, and `GrammarChapterCoverageChart` (issue #58) -
 * they only differ in how `rows` is computed (different index shapes,
 * different mastery predicates, different row identity), not in how the
 * result is drawn.
 *
 * One hue in two steps rather than two hues - the segments are ordinal stages
 * of the same thing (an item on its way to mastery), and the design system
 * reserves the secondary accent for errors. The legend plus the direct labels
 * carry the distinction, so it never rests on color alone.
 */
export function JlptCoverageBars({ rows, itemLabel, headline, keyColumnLabel = "Level", maxVisibleRows = 10 }: JlptCoverageBarsProps) {
    const [hoverKey, setHoverKey] = useState<string | number | null>(null);

    const totals = rows.reduce(
        (acc, r) => ({
            mastered: acc.mastered + r.mastered,
            learning: acc.learning + r.learning,
            total: acc.total + r.total,
        }),
        { mastered: 0, learning: 0, total: 0 }
    );

    const started = totals.mastered + totals.learning;
    const startedPct = totals.total > 0 ? Math.round((started / totals.total) * 100) : 0;

    return (
        <div className="flex flex-col gap-4">
            {/* Headline + legend */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="flex flex-col">
                    <span className="text-xs text-tertiary uppercase tracking-wider font-gothic">
                        {headline ?? `JLPT ${itemLabel} covered`}
                    </span>
                    <span className="text-3xl text-primary leading-tight tabular-nums">
                        {started.toLocaleString()}
                        <span className="text-lg text-tertiary"> / {totals.total.toLocaleString()}</span>
                    </span>
                    <span className="text-sm text-secondary tabular-nums">
                        {startedPct}% started
                        <span className="text-tertiary"> · {totals.mastered.toLocaleString()} mastered</span>
                    </span>
                </div>

                <div className="flex gap-4 self-start sm:self-end text-xs text-secondary">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-accent" aria-hidden="true" />
                        Mastered
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-accent opacity-35" aria-hidden="true" />
                        In progress
                    </span>
                </div>
            </div>

            {/* Bars, in row order (N5-first for JLPT, teaching order for chapters) */}
            <div
                className={rows.length > maxVisibleRows
                    ? "flex flex-col gap-2.5 max-h-[26rem] overflow-y-auto scrollbar-subtle pr-1"
                    : "flex flex-col gap-2.5"}
            >
                {rows.map(row => {
                    const masteredPct = row.total > 0 ? (row.mastered / row.total) * 100 : 0;
                    const learningPct = row.total > 0 ? (row.learning / row.total) * 100 : 0;
                    const rowStarted = row.mastered + row.learning;
                    const isHovered = hoverKey === row.key;

                    return (
                        <div
                            key={row.key}
                            className="flex items-center gap-3"
                            onMouseEnter={() => setHoverKey(row.key)}
                            onMouseLeave={() => setHoverKey(null)}
                        >
                            <span className="w-14 shrink-0 text-xs text-secondary font-gothic truncate" title={row.label}>
                                {row.label}
                            </span>

                            <div className="relative flex-1 min-w-0">
                                <div className="flex h-5 w-full rounded-sm overflow-hidden bg-surface-hover/50">
                                    {masteredPct > 0 && (
                                        <div
                                            className="h-full bg-accent transition-all duration-200"
                                            style={{ width: `${masteredPct}%` }}
                                        />
                                    )}
                                    {learningPct > 0 && (
                                        <div
                                            className="h-full bg-accent opacity-35 transition-all duration-200"
                                            // 2px surface gap so the two segments read as distinct
                                            // fills rather than one bar with a tonal shift.
                                            style={{
                                                width: `${learningPct}%`,
                                                marginLeft: masteredPct > 0 ? '2px' : undefined,
                                            }}
                                        />
                                    )}
                                </div>

                                {isHovered && (
                                    <div className="absolute left-2 -top-1 z-20 pointer-events-none -translate-y-full bg-surface border border-divider shadow-md rounded px-2 py-1 text-[11px] w-max max-w-64">
                                        <div className="text-tertiary truncate">{row.label}</div>
                                        <div className="text-primary tabular-nums">
                                            {row.mastered.toLocaleString()} mastered
                                        </div>
                                        <div className="text-secondary tabular-nums">
                                            {row.learning.toLocaleString()} in progress
                                        </div>
                                        <div className="text-tertiary tabular-nums">
                                            {(row.total - rowStarted).toLocaleString()} untouched
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Direct label - the value is readable without hovering */}
                            <span className="w-24 shrink-0 text-right text-xs text-secondary tabular-nums">
                                {rowStarted.toLocaleString()}
                                <span className="text-tertiary"> / {row.total.toLocaleString()}</span>
                            </span>
                        </div>
                    );
                })}
            </div>

            <details className="text-xs">
                <summary className="cursor-pointer text-tertiary hover:text-secondary select-none">
                    Show data
                </summary>
                <table className="w-full mt-3 text-left border-collapse">
                    <thead>
                        <tr className="text-tertiary">
                            <th className="font-normal py-1 pr-3">{keyColumnLabel}</th>
                            <th className="font-normal py-1 pr-3 text-right">Mastered</th>
                            <th className="font-normal py-1 pr-3 text-right">In progress</th>
                            <th className="font-normal py-1 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="text-secondary tabular-nums">
                        {rows.map(row => (
                            <tr key={row.key} className="border-t border-divider">
                                <td className="py-1 pr-3">{row.label}</td>
                                <td className="py-1 pr-3 text-right">{row.mastered.toLocaleString()}</td>
                                <td className="py-1 pr-3 text-right">{row.learning.toLocaleString()}</td>
                                <td className="py-1 text-right">{row.total.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
