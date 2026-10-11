import { useState } from "react";
import { segmentHeightPercent, stackedBarDomOrder } from "../../utils/stackedBarChart.utils";

export interface StackedBarChartSegment {
    key: string;
    label: string;
    color: string;
}

export interface StackedBarChartBar {
    /** The x-axis label, shown in full: "Now", "Later today", "Tmrw", a three-letter weekday. */
    label: string;
    values: Record<string, number>;
    /** Shown under the label, e.g. "(Due)". */
    footnote?: string;
    /** Dims the bar, e.g. for a weekend day in a week-long chart. */
    muted?: boolean;
}

interface StackedBarChartProps {
    /** Bottom to top: the first segment sits at the baseline. */
    segments: StackedBarChartSegment[];
    bars: StackedBarChartBar[];
    /** Chart plot height in pixels. */
    height?: number;
    /** Overrides the auto-computed max (the largest bar total, floored at 1). */
    maxValue?: number;
    showLegend?: boolean;
}

/**
 * The one stacked bar chart, replacing three near-identical copies (the hub
 * week chart, the review forecast and the daily-activity history). Each used
 * `flex-col-reverse` with `justify-end` to anchor bars to the bottom, which
 * instead anchors them to the TOP (see stackedBarChart.utils.ts) - every bar
 * in every one of them hung from the ceiling.
 */
export function StackedBarChart({ segments, bars, height = 128, maxValue, showLegend = false }: StackedBarChartProps) {
    const [shownIndex, setShownIndex] = useState<number | null>(null);

    const barTotal = (bar: StackedBarChartBar) => segments.reduce((sum, s) => sum + (bar.values[s.key] ?? 0), 0);
    const max = maxValue ?? Math.max(1, ...bars.map(barTotal));
    const mid = Math.round(max / 2);

    const show = (i: number) => setShownIndex(i);
    const hide = (i: number) => setShownIndex(prev => (prev === i ? null : prev));
    const toggle = (i: number) => setShownIndex(prev => (prev === i ? null : i));

    return (
        <div className="w-full">
            {showLegend && (
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-2 type-meta">
                    {segments.map(s => (
                        <span key={s.key} className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                            {s.label}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-2" style={{ height }}>
                <div className="flex flex-col justify-between items-end type-meta pr-1" style={{ height }}>
                    <span>{max}</span>
                    <span>{mid}</span>
                    <span>0</span>
                </div>

                <div className="relative flex-1 flex items-end gap-1.5" style={{ height }}>
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-divider/50 pointer-events-none" aria-hidden="true" />
                    <div className="absolute inset-x-0 bottom-0 border-t border-divider/50 pointer-events-none" aria-hidden="true" />

                    {bars.map((bar, i) => {
                        const total = barTotal(bar);
                        const present = segments.filter(s => (bar.values[s.key] ?? 0) > 0);
                        const domOrder = stackedBarDomOrder(present);
                        const isShown = shownIndex === i;

                        return (
                            <button
                                key={i}
                                type="button"
                                className={`relative flex flex-col items-center flex-1 min-w-0 h-full justify-end z-10 ${bar.muted ? 'opacity-60' : ''}`}
                                onMouseEnter={() => show(i)}
                                onMouseLeave={() => hide(i)}
                                onFocus={() => show(i)}
                                onBlur={() => hide(i)}
                                onClick={() => toggle(i)}
                                aria-label={`${bar.label}: ${segments.map(s => `${s.label} ${bar.values[s.key] ?? 0}`).join(', ')}`}
                            >
                                <div className="w-full flex flex-col justify-end items-center h-full max-w-[28px] mx-auto">
                                    {domOrder.map((segment, idx) => (
                                        <div
                                            key={segment.key}
                                            className={`w-full transition-all duration-200 ${idx === domOrder.length - 1 ? 'rounded-b-sm' : ''} ${idx === 0 ? 'rounded-t-sm' : ''}`}
                                            style={{
                                                height: `${segmentHeightPercent(bar.values[segment.key] ?? 0, max)}%`,
                                                backgroundColor: segment.color,
                                            }}
                                        />
                                    ))}
                                </div>

                                {isShown && total > 0 && (
                                    <div
                                        role="tooltip"
                                        className="absolute -top-2 translate-y-[-100%] bg-surface border border-divider shadow-md rounded-md p-1.5 flex flex-col items-center text-xs w-max z-20 pointer-events-none"
                                    >
                                        <span className="font-medium text-primary">{total} total</span>
                                        {present.map(s => (
                                            <span key={s.key} className="text-secondary">{s.label}: {bar.values[s.key] ?? 0}</span>
                                        ))}
                                    </div>
                                )}

                                <span className="type-meta mt-1.5 w-full text-center">{bar.label}</span>
                                {bar.footnote && <span className="type-meta">{bar.footnote}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
