import type { SRSEntry } from "../models/vocabulary.model";
import { useMemo } from "react";
import { useNow } from "../hooks/useNow";
import { learningCurve } from "../utils/learningCurve.utils";
import { formatShortDate } from "../utils/time.utils";

export interface SRSHistorySeries {
    /** Stable key distinguishing this series from others in the same graph (e.g. 'reading', 'meaning', 'grammar'). */
    key: string;
    label: string;
    entry: SRSEntry;
    color: string;
}

interface SRSHistoryGraphProps {
    series: SRSHistorySeries[];
    introDate?: Date | null;
}

/**
 * The learning curve: mastery (0 to 100%, the rings' loop 1) over time, one line
 * per direction, from the introduction date to now (`learningCurve`). Shared by
 * the vocab page (reading, meaning, production once activated) and the grammar
 * page (one entry): a grammar entry is shaped exactly like a vocab direction.
 */
export function SRSHistoryGraph({ series, introDate }: SRSHistoryGraphProps) {
    const now = useNow();
    const curves = useMemo(
        () => series.map(s => ({ ...s, points: learningCurve(s.entry, introDate ?? null, now) })),
        [series, introDate, now],
    );

    // A line needs at least one review between the start and now.
    if (!curves.some(c => c.points.length > (introDate ? 2 : 1))) return null;

    const dates = curves.flatMap(c => c.points.map(p => p.date));
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const timeSpan = maxDate - minDate || 1;

    const pathOf = (points: { date: number; percent: number }[]) => points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${((p.date - minDate) / timeSpan) * 100} ${100 - p.percent}`)
        .join(' ');

    return (
        <figure className="w-full" aria-label="Learning curve: mastery over time">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <figcaption className="type-label">Learning curve</figcaption>
                {series.length > 1 && (
                    <div className="flex gap-3">
                        {series.map(s => (
                            <span key={s.key} className="flex items-center gap-1 type-meta">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} aria-hidden="true" />
                                {s.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <div className="flex flex-col justify-between h-28 type-meta text-right tabular-nums" aria-hidden="true">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-28 relative">
                        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            {[0, 50, 100].map(y => (
                                <line key={y} x1="0" y1={y} x2="100" y2={y} className="stroke-divider" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            ))}
                            {curves.map(c => (
                                <path
                                    key={c.key}
                                    d={pathOf(c.points)}
                                    fill="none"
                                    style={{ stroke: c.color }}
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            ))}
                        </svg>
                    </div>
                    <div className="flex justify-between type-meta mt-1">
                        <span>{formatShortDate(new Date(minDate))}</span>
                        <span>Now</span>
                    </div>
                </div>
            </div>
        </figure>
    );
}
