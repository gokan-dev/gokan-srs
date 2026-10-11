import { THEME } from "../../../commons/theme";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import { useMemo } from "react";
import { buildReviewForecast } from "../../../utils/reviewForecast.utils";
import { useNow } from "../../../hooks/useNow";
import { StackedBarChart, type StackedBarChartSegment } from "../../../components/ui/StackedBarChart";

interface ReviewForecastProps {
    progress: UserProgress;
    settings?: UserSettings;
}

// Bottom to top. Three steps of one hue (the design system reserves a second hue
// for errors), so the legend below carries the distinction.
const SEGMENTS: StackedBarChartSegment[] = [
    { key: 'reading', label: 'Reading', color: THEME.mastery.reading.loop1 },
    { key: 'meaning', label: 'Meaning', color: THEME.mastery.meaning.loop1 },
    { key: 'production', label: 'Production', color: THEME.mastery.production.loop1 },
];

export function ReviewForecast({ progress, settings }: ReviewForecastProps) {
    const now = useNow();
    const bars = useMemo(() => {
        const buckets = buildReviewForecast(progress.learningQueue, settings, new Date(now));
        return buckets.map((bucket, i) => ({
            label: bucket.label,
            values: { reading: bucket.reading, meaning: bucket.meaning, production: bucket.production },
            footnote: i === 0 && bucket.reading + bucket.meaning + bucket.production > 0 ? '(Due)' : undefined,
        }));
    }, [progress, settings, now]);

    return <StackedBarChart segments={SEGMENTS} bars={bars} height={200} showLegend />;
}
