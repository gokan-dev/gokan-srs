import React, { useMemo } from 'react';
import { THEME } from '../../commons/theme';
import type { UserProgress } from '../../models/user.model';
import { buildDailyActivity } from '../../utils/activity.utils';
import { formatWeekday } from '../../utils/time.utils';
import { StackedBarChart, type StackedBarChartSegment } from '../../components/ui/StackedBarChart';

const DAYS_SHOWN = 7;

const SEGMENTS: StackedBarChartSegment[] = [
    { key: 'correct', label: 'Correct', color: THEME.colors.correct },
    { key: 'incorrect', label: 'Incorrect', color: THEME.colors.error },
];

/**
 * Replaces the old ephemeral `lastSessionRecap` (overwritten by the next session,
 * so it rarely reflected a full day of several small sessions - see issue #30).
 * Reads persisted reading/meaning review history instead, so it's stable across
 * however many sessions happened today. Shares its per-day bucketing with
 * `DailyProgressionChart` via `buildDailyActivity` rather than re-deriving it.
 */
export const DailyActivityCard: React.FC<{ progress: UserProgress }> = ({ progress }) => {
    const buckets = useMemo(() => buildDailyActivity(progress, DAYS_SHOWN), [progress]);
    const today = buckets[buckets.length - 1];
    const todayReviewed = today.correct + today.incorrect;

    const bars = buckets.map((bucket, i) => ({
        label: i === buckets.length - 1 ? 'Today' : formatWeekday(bucket.date),
        values: { correct: bucket.correct, incorrect: bucket.incorrect },
    }));

    return (
        <div className="mb-8 border border-divider rounded-md bg-surface p-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                <div className="flex flex-col">
                    <span className="type-meta">Today</span>
                    <span className="text-2xl text-primary leading-tight tabular-nums">{todayReviewed}</span>
                    <span className="text-sm text-secondary tabular-nums">
                        {todayReviewed === 0 ? 'No reviews yet' : (
                            <>
                                {today.correct} correct
                                {today.incorrect > 0 && <span className="text-error"> · {today.incorrect} incorrect</span>}
                            </>
                        )}
                    </span>
                </div>
            </div>

            <StackedBarChart segments={SEGMENTS} bars={bars} height={64} showLegend />
        </div>
    );
};
