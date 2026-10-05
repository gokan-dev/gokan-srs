import type { SRSEntry, ReviewLog } from "../models/vocabulary.model";
import { useMemo } from "react";
import { useNow } from "../hooks/useNow";

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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Plots interval-over-time for one or more SRSEntry series, shared between
 * VocabDetailScreen (reading + meaning) and GrammarDetailScreen (a single
 * grammar entry) - a GrammarProgress.entry is shaped exactly like a
 * VocabProgress.reading/meaning entry for this purpose, so one component
 * covers both rather than duplicating the plotting logic per activity.
 */
export function SRSHistoryGraph({ series, introDate }: SRSHistoryGraphProps) {
    const now = useNow();
    const data = useMemo(() => {
        // Collect all history points
        const points: { date: number; key: string; strength: number }[] = [];

        // Add intro as baseline 0 for every series if available
        if (introDate) {
            series.forEach(s => points.push({ date: new Date(introDate).getTime(), key: s.key, strength: 0 }));
        }

        series.forEach(s => {
            s.entry.history.forEach((h: ReviewLog) => {
                points.push({ date: new Date(h.date).getTime(), key: s.key, strength: h.interval });
            });
        });

        // Current actual states as final points if they differ from last history or if history is empty
        series.forEach(s => points.push({ date: now, key: s.key, strength: s.entry.interval }));

        // Sort by date
        points.sort((a, b) => a.date - b.date);

        return points;
    }, [series, introDate, now]);

    // If practically no data, don't render graph (one intro + one end point per series is not real history)
    if (data.length <= series.length * 2) return null;

    const minDate = data[0].date;
    const maxDate = data[data.length - 1].date;
    const timeSpan = maxDate - minDate || 1; // Prevent div zero

    const maxStrength = 365; // ~1 year interval indicates mastery
    const actualMaxStrength = Math.max(...data.map(d => d.strength), 3); // scale down floor if items are very new
    const yMax = Math.min(Math.max(actualMaxStrength * 1.2, 3), maxStrength * 1.1);

    const generatePath = (key: string) => {
        const seriesPoints = data.filter(d => d.key === key);
        if (seriesPoints.length === 0) return "";

        return seriesPoints.map((p, i) => {
            const x = ((p.date - minDate) / timeSpan) * 100;
            // yMax is capped at the mastery ceiling, so an entry sitting at
            // maxInterval (a skipped/mastered item, 3650d) plots far above the
            // viewBox. Clamp instead: such a curve rides the top of the chart
            // rather than being drawn hundreds of units outside it.
            const y = clamp(100 - ((p.strength / yMax) * 100), 0, 100);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(" ");
    };

    return (
        <div className="w-full flex flex-col pt-4 border-t border-divider mt-6">
            <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">Learning Curve</span>
                <div className="flex gap-4 text-xs font-gothic">
                    {series.map(s => (
                        <span key={s.key} className="flex items-center gap-1 text-secondary">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }}></span>
                            {s.label}
                        </span>
                    ))}
                </div>
            </div>

            <div className="w-full h-32 relative">
                <svg className="w-full h-full overflow-hidden" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid Lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" className="text-divider opacity-30" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-divider opacity-30" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" className="text-divider opacity-50" strokeWidth="0.5" />

                    {/* Max Mastery Guideline (If applicable within view) */}
                    {yMax >= maxStrength && (
                        <line x1="0" y1={100 - ((maxStrength / yMax) * 100)} x2="100" y2={100 - ((maxStrength / yMax) * 100)} stroke="currentColor" className="text-green-500 opacity-20" strokeWidth="0.5" />
                    )}

                    {series.map(s => {
                        const path = generatePath(s.key);
                        if (!path) return null;
                        return (
                            <path
                                key={s.key}
                                d={path}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="drop-shadow-sm opacity-80"
                            />
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
