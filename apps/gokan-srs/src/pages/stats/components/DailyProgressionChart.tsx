import { THEME } from "../../../commons/theme";
import type { UserProgress } from "../../../models/user.model";
import { buildDailyActivity } from "../../../utils/activity.utils";
import { formatWeekday } from "../../../utils/time.utils";
import { useMemo } from "react";
import { StackedBarChart, type StackedBarChartSegment } from "../../../components/ui/StackedBarChart";

interface DailyProgressionChartProps {
    progress: UserProgress;
}

const SEGMENTS: StackedBarChartSegment[] = [
    { key: 'correct', label: 'Correct', color: THEME.colors.correct },
    { key: 'incorrect', label: 'Incorrect', color: THEME.colors.error },
];

export function DailyProgressionChart({ progress }: DailyProgressionChartProps) {
    const bars = useMemo(() => {
        const daysToShow = 14;
        const dailyActivity = buildDailyActivity(progress, daysToShow);

        return dailyActivity.map((bucket, idx) => {
            const i = daysToShow - 1 - idx;
            const label = i === 0 ? 'Today' : (i === 1 ? 'Yesterday' : formatWeekday(bucket.date));
            const isWeekend = bucket.date.getDay() === 0 || bucket.date.getDay() === 6;
            return { label, values: { correct: bucket.correct, incorrect: bucket.incorrect }, muted: isWeekend };
        });
    }, [progress]);

    return <StackedBarChart segments={SEGMENTS} bars={bars} height={200} showLegend />;
}
