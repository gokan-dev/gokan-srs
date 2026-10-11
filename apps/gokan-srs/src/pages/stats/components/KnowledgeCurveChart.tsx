import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import {
    KNOWLEDGE_POINTS_PER_ENTRY,
    buildKnowledgeCurve,
    type KnowledgeCurvePoint,
    type KnowledgeCurveRange,
} from "../../../utils/knowledge.utils";
import { formatShortDate } from "../../../utils/time.utils";
import { FilterToggle } from "../../../components/ui/FilterToggle";
import { THEME } from "../../../commons/theme";

interface KnowledgeCurveChartProps {
    progress: UserProgress;
    settings?: UserSettings;
}

const RANGES: { label: string; value: KnowledgeCurveRange }[] = [
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: '1 year', value: 365 },
    { label: 'All', value: 'all' },
];

/** Plot geometry, in the SVG's own 0-100 user space. */
const PLOT = { top: 4, bottom: 96 };

function formatPoints(value: number): string {
    return Math.round(value).toLocaleString('en-US');
}

/**
 * Cumulative "knowledge" held over time - the sum of how far every vocabulary
 * item has matured, in both reading and meaning. The question it answers is
 * whether the user is still climbing or has plateaued, so it is deliberately a
 * single cumulative series rather than a per-day activity count (which the Daily
 * Progression chart above already covers).
 */
export function KnowledgeCurveChart({ progress, settings }: KnowledgeCurveChartProps) {
    const [range, setRange] = useState<KnowledgeCurveRange>(90);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const curve = useMemo(
        () => buildKnowledgeCurve(progress.learningQueue || [], { range, settings }),
        [progress.learningQueue, range, settings]
    );

    const { points } = curve;
    // Reduce rather than Math.max(...spread): an 'all' range is unbounded in
    // length, and a large spread overflows the argument stack.
    const yMax = points.reduce((max, p) => (p.points > max ? p.points : max), 1);

    const xAt = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
    const yAt = (value: number) => PLOT.bottom - (value / yMax) * (PLOT.bottom - PLOT.top);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.points)}`).join(' ');
    const areaPath = points.length > 1
        ? `${linePath} L 100 ${PLOT.bottom} L 0 ${PLOT.bottom} Z`
        : '';

    const active: KnowledgeCurvePoint | null = hoverIndex !== null ? points[hoverIndex] ?? null : null;

    // Aggregated rows for the table view - the chart's non-hover, screen-reader
    // readable twin. Always ~8 rows regardless of how long the window is.
    const tableRows = useMemo(() => {
        const bucketCount = Math.min(8, points.length);
        const bucketSize = Math.ceil(points.length / bucketCount);
        const rows: { label: string; total: number; gained: number }[] = [];

        for (let start = 0; start < points.length; start += bucketSize) {
            const slice = points.slice(start, start + bucketSize);
            const last = slice[slice.length - 1];
            rows.push({
                label: slice.length === 1
                    ? formatShortDate(slice[0].date)
                    : `${formatShortDate(slice[0].date)} – ${formatShortDate(last.date)}`,
                total: last.points,
                gained: slice.reduce((sum, p) => sum + p.gain, 0),
            });
        }

        return rows;
    }, [points]);

    const handleMove = (e: MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width === 0) return;
        const fraction = (e.clientX - rect.left) / rect.width;
        const index = Math.round(fraction * (points.length - 1));
        setHoverIndex(Math.min(Math.max(index, 0), points.length - 1));
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Headline + range filter */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="flex flex-col">
                    <span className="font-sans text-2xl text-primary tabular-nums">
                        {curve.gained >= 0 ? '+' : '−'}{formatPoints(Math.abs(curve.gained))} points
                        <span className="type-support ml-2">{range === 'all' ? 'since you started' : `in ${RANGES.find(r => r.value === range)?.label ?? `${range} days`}`}</span>
                    </span>
                    <span className="type-meta mt-1">
                        {formatPoints(curve.currentTotal)} held now · {formatPoints(curve.averagePerDay)} a day on average.
                        A point is one step of mastery: a direction you have fully mastered is worth {KNOWLEDGE_POINTS_PER_ENTRY}.
                    </span>
                </div>

                <div className="flex gap-1.5 self-start sm:self-end shrink-0" role="group" aria-label="Time range">
                    {RANGES.map(r => (
                        <FilterToggle key={String(r.value)} active={range === r.value} onClick={() => setRange(r.value)}>
                            {r.label}
                        </FilterToggle>
                    ))}
                </div>
            </div>

            {/* Plot */}
            <div className="flex gap-2">
                {/* Y axis. The vertical padding matches the plot's own inset
                    (PLOT.top/bottom as a fraction of the 160px track) so each label
                    lines up with its gridline rather than the container edge. */}
                <div
                    className="flex flex-col justify-between h-40 text-xs text-tertiary tabular-nums text-right shrink-0 w-10"
                    style={{
                        paddingTop: `${(PLOT.top / 100) * 160}px`,
                        paddingBottom: `${((100 - PLOT.bottom) / 100) * 160}px`,
                    }}
                >
                    <span>{formatPoints(yMax)}</span>
                    <span>{formatPoints(yMax / 2)}</span>
                    <span>0</span>
                </div>

                <div className="flex-1 min-w-0">
                    <div
                        className="relative h-40 cursor-crosshair"
                        onMouseMove={handleMove}
                        onMouseLeave={() => setHoverIndex(null)}
                    >
                        <svg
                            className="w-full h-full"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                        >
                            {/* Recessive solid hairline grid */}
                            {[PLOT.top, (PLOT.top + PLOT.bottom) / 2, PLOT.bottom].map(y => (
                                <line
                                    key={y}
                                    x1="0" y1={y} x2="100" y2={y}
                                    stroke="var(--divider)"
                                    strokeWidth="1"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}

                            {areaPath && (
                                <path d={areaPath} fill={THEME.colors.accent} opacity="0.08" />
                            )}

                            {linePath && (
                                <path
                                    d={linePath}
                                    fill="none"
                                    stroke={THEME.colors.accent}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}

                            {active && (
                                <line
                                    x1={xAt(hoverIndex!)} y1={PLOT.top}
                                    x2={xAt(hoverIndex!)} y2={PLOT.bottom}
                                    stroke={THEME.colors.accent}
                                    strokeWidth="1"
                                    opacity="0.4"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}
                        </svg>

                        {/* Hover marker - an HTML dot rather than an SVG circle, which
                            the non-uniform viewBox scaling would squash into an ellipse. */}
                        {active && (
                            <div
                                className="absolute w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-surface pointer-events-none -translate-x-1/2 -translate-y-1/2"
                                style={{
                                    left: `${xAt(hoverIndex!)}%`,
                                    top: `${yAt(active.points)}%`,
                                }}
                            />
                        )}

                        {/* Endpoint direct label, so the current value is readable
                            without hovering. Hidden while a hover tooltip is showing. */}
                        {!active && points.length > 1 && (
                            <div
                                className="absolute text-xs text-secondary tabular-nums pointer-events-none -translate-y-1/2 pr-1"
                                style={{ right: 0, top: `${yAt(points[points.length - 1].points)}%` }}
                            >
                                {formatPoints(curve.currentTotal)}
                            </div>
                        )}

                        {active && (
                            <div
                                className="absolute -top-2 z-20 pointer-events-none bg-surface border border-divider shadow-md rounded px-2 py-1 text-xs w-max -translate-x-1/2"
                                style={{
                                    left: `${Math.min(Math.max(xAt(hoverIndex!), 12), 88)}%`,
                                }}
                            >
                                <div className="text-tertiary">{formatShortDate(active.date)}</div>
                                <div className="text-primary tabular-nums">
                                    {formatPoints(active.points)} held
                                </div>
                                <div className="text-secondary tabular-nums">
                                    {active.gain >= 0 ? '+' : '−'}{formatPoints(Math.abs(active.gain))} that day
                                </div>
                            </div>
                        )}
                    </div>

                    {/* X axis band */}
                    <div className="flex justify-between text-xs text-tertiary mt-2">
                        <span>{formatShortDate(points[0].date)}</span>
                        <span>{formatShortDate(points[points.length - 1].date)}</span>
                    </div>
                </div>
            </div>

            {curve.flatDays > 0 && (
                <p className="text-xs text-tertiary">
                    {curve.flatDays} of {points.length} days without progress.
                </p>
            )}

            <details className="text-xs">
                <summary className="cursor-pointer text-tertiary hover:text-secondary select-none">
                    Show data
                </summary>
                <table className="w-full mt-3 text-left border-collapse">
                    <thead>
                        <tr className="text-tertiary">
                            <th className="font-normal py-1 pr-3">Period</th>
                            <th className="font-normal py-1 pr-3 text-right">Held</th>
                            <th className="font-normal py-1 text-right">Gained</th>
                        </tr>
                    </thead>
                    <tbody className="text-secondary tabular-nums">
                        {tableRows.map(row => (
                            <tr key={row.label} className="border-t border-divider">
                                <td className="py-1 pr-3 whitespace-nowrap">{row.label}</td>
                                <td className="py-1 pr-3 text-right">{formatPoints(row.total)}</td>
                                <td className="py-1 text-right">
                                    {row.gained >= 0 ? '+' : '−'}{formatPoints(Math.abs(row.gained))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
