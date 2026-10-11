import React, { useMemo } from 'react';
import { THEME } from '../../commons/theme';
import type { UserProgress } from '../../models/user.model';
import { buildDailyActivity } from '../../utils/activity.utils';
import { formatWeekday } from '../../utils/time.utils';
import { StackedBarChart, type StackedBarChartSegment } from '../../components/ui/StackedBarChart';

const DAYS_SHOWN = 7;

const SEGMENTS: StackedBarChartSegment[] = [
    { key: 'correct', label: 'Correct', color: THEME.colors.correct },
    { key: 'incorrect', label: 'Incorrect', color: THEME.colors.incorrect },
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
        <section className="mt-10">
            <h2 className="type-section">This week</h2>
            <p className="type-support mt-1 mb-4">
                {todayReviewed === 0
                    ? 'No reviews today yet'
                    : `Today: ${todayReviewed.toLocaleString('en-US')} review${todayReviewed === 1 ? '' : 's'}, ${today.correct.toLocaleString('en-US')} correct`}
            </p>
            <StackedBarChart segments={SEGMENTS} bars={bars} height={48} showLegend />
        </section>
    );
};
