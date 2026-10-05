import { THEME } from "../../../commons/theme";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import { useMemo } from "react";
import { buildReviewForecast } from "../../../utils/reviewForecast.utils";
import { useNow } from "../../../hooks/useNow";

interface ReviewForecastProps {
    progress: UserProgress;
    settings?: UserSettings;
}

// Bottom to top. Three steps of one hue (the design system reserves a second hue
// for errors), so the legend below carries the distinction.
const SEGMENTS = [
    { key: 'reading', label: 'Reading', color: THEME.mastery.reading.loop1 },
    { key: 'meaning', label: 'Meaning', color: THEME.mastery.meaning.loop1 },
    { key: 'production', label: 'Production', color: THEME.mastery.production.loop1 },
] as const;

export function ReviewForecast({ progress, settings }: ReviewForecastProps) {
    const now = useNow();
    const forecast = useMemo(() => {
        const buckets = buildReviewForecast(progress.learningQueue, settings, new Date(now));
        // Min 10 so a near-empty week does not draw full-height bars.
        const maxCount = Math.max(10, ...buckets.map(b => b.reading + b.meaning + b.production));
        return { buckets, maxCount };
    }, [progress, settings, now]);

    return (
        <div className="w-full">
            <div className="w-full flex justify-between items-end h-[200px] gap-2 py-4 relative">
                {/* Background Grid */}
                <div className="absolute inset-0 w-full h-full pointer-events-none z-0 flex flex-col justify-between py-4 pl-4">
                    <div className="w-full h-px border-t border-dashed border-divider/50"></div>
                    <div className="w-full h-px border-t border-dashed border-divider/50"></div>
                    <div className="w-full h-px border-t border-dashed border-divider/50"></div>
                </div>

                {forecast.buckets.map((bucket, i) => {
                    const total = bucket.reading + bucket.meaning + bucket.production;
                    const present = SEGMENTS.filter(s => bucket[s.key] > 0);

                    return (
                        <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group z-10">
                            <div className="relative w-full flex flex-col justify-end items-center flex-1 mb-2 max-w-[28px]">
                                {/* Stacked Bars Container */}
                                <div className="w-full flex flex-col-reverse items-center justify-end h-full">
                                    {present.map((segment, idx) => (
                                        <div
                                            key={segment.key}
                                            title={`${segment.label}: ${bucket[segment.key]}`}
                                            className={`w-full transition-all duration-300 relative ${idx === 0 ? 'rounded-b-sm' : ''} ${idx === present.length - 1 ? 'rounded-t-sm' : ''}`}
                                            style={{
                                                height: `${(bucket[segment.key] / forecast.maxCount) * 100}%`,
                                                backgroundColor: segment.color,
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Total Label (Top) */}
                                <span className="text-xs font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 text-gray-600 dark:text-gray-400">
                                    {total}
                                </span>
                            </div>

                            <span className="text-[10px] sm:text-xs text-secondary font-medium mt-2 w-full text-center truncate px-0.5">
                                <span className="sm:hidden">{bucket.label.charAt(0)}</span>
                                <span className="hidden sm:inline">{bucket.label}</span>
                            </span>

                            {/* Legend/Total Text at bottom */}
                            <div className="flex flex-col items-center w-full text-[10px] text-tertiary mt-1 leading-none truncate overflow-hidden">
                                <span>{i === 0 && total > 0 ? '(Due)' : total > 0 ? total : '-'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-xs text-secondary font-gothic">
                {SEGMENTS.map(s => (
                    <span key={s.key} className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
