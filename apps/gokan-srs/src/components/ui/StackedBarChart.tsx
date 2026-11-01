import { useState } from "react";
import { axisTicks, segmentHeightPercent, showsLabelWhenNarrow, stackedBarDomOrder } from "../../utils/stackedBarChart.utils";

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
    /** Names the bar in its tooltip and for screen readers when the axis label is terse ("3" for Nov 3). */
    title?: string;
}

interface StackedBarChartProps {
    /** Bottom to top: the first segment sits at the baseline. */
    segments: StackedBarChartSegment[];
    bars: StackedBarChartBar[];
    /** Plot height in pixels (the bars only; labels sit below). */
    height?: number;
    /** Overrides the auto-computed max (the largest bar total, floored at 1). */
    maxValue?: number;
    showLegend?: boolean;
}

/**
 * The one stacked bar chart (the hub's week, the review forecast, daily
 * activity). Bars share a bottom baseline (see stackedBarChart.utils.ts for why
 * the DOM order is reversed), a y-axis names the max and the midline, and every
 * bar is a button showing its values on hover, focus and tap.
 */
export function StackedBarChart({ segments, bars, height = 128, maxValue, showLegend = false }: StackedBarChartProps) {
    const [shownIndex, setShownIndex] = useState<number | null>(null);

    const barTotal = (bar: StackedBarChartBar) => segments.reduce((sum, s) => sum + (bar.values[s.key] ?? 0), 0);
    const ticks = axisTicks(maxValue ?? Math.max(1, ...bars.map(barTotal)));
    const max = ticks[0];

    const show = (i: number) => setShownIndex(i);
    const hide = (i: number) => setShownIndex(prev => (prev === i ? null : prev));
    const toggle = (i: number) => setShownIndex(prev => (prev === i ? null : i));
    // A month of bars at 320px leaves no room for the usual gap between them.
    const gap = bars.length > 20 ? 'gap-px' : 'gap-1.5';

    return (
        <div className="w-full">
            {showLegend && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 type-meta">
                    {segments.map(s => (
                        <span key={s.key} className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                            {s.label}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <div className="flex flex-col justify-between items-end type-meta tabular-nums shrink-0 -my-2" style={{ height: height + 16 }} aria-hidden="true">
                    {ticks.map(tick => <span key={tick}>{tick.toLocaleString('en-US')}</span>)}
                </div>

                <div className="flex-1 min-w-0">
                    <div className={`relative flex items-end ${gap}`} style={{ height }}>
                        {ticks.slice(0, -1).map(tick => (
                            <div
                                key={tick}
                                className="absolute inset-x-0 border-t border-dashed border-divider pointer-events-none"
                                style={{ bottom: `${(tick / max) * 100}%` }}
                                aria-hidden="true"
                            />
                        ))}
                        <div className="absolute inset-x-0 bottom-0 border-t border-divider pointer-events-none" aria-hidden="true" />

                        {bars.map((bar, i) => {
                            const total = barTotal(bar);
                            const present = segments.filter(s => (bar.values[s.key] ?? 0) > 0);
                            const domOrder = stackedBarDomOrder(present);

                            return (
                                <button
                                    key={i}
                                    type="button"
                                    className="relative flex flex-col justify-end items-center flex-1 min-w-0 h-full cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    onMouseEnter={() => show(i)}
                                    onMouseLeave={() => hide(i)}
                                    onFocus={() => show(i)}
                                    onBlur={() => hide(i)}
                                    onClick={() => toggle(i)}
                                    aria-label={`${bar.title ?? bar.label}: ${segments.map(s => `${s.label} ${bar.values[s.key] ?? 0}`).join(', ')}`}
                                >
                                    {domOrder.map((segment, idx) => (
                                        <div
                                            key={segment.key}
                                            className={`w-full max-w-7 transition-all duration-200 ${idx === 0 ? 'rounded-t-sm' : ''}`}
                                            style={{
                                                height: `${segmentHeightPercent(bar.values[segment.key] ?? 0, max)}%`,
                                                backgroundColor: segment.color,
                                            }}
                                        />
                                    ))}

                                    {shownIndex === i && (
                                        <div
                                            role="tooltip"
                                            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-surface border border-divider shadow-md rounded-md px-2 py-1.5 flex flex-col items-start text-xs w-max z-20 pointer-events-none"
                                        >
                                            <span className="font-medium text-primary">{bar.title ?? bar.label}: {total.toLocaleString('en-US')}</span>
                                            {segments.map(s => (
                                                <span key={s.key} className="text-secondary">{s.label}: {(bar.values[s.key] ?? 0).toLocaleString('en-US')}</span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className={`flex ${gap} mt-1.5`} aria-hidden="true">
                        {bars.map((bar, i) => (
                            <div key={i} className={`flex-1 min-w-0 text-center type-meta leading-tight ${showsLabelWhenNarrow(i, bars.length) ? '' : 'invisible md:visible'}`}>
                                {bar.label}
                                {bar.footnote && <div>{bar.footnote}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
