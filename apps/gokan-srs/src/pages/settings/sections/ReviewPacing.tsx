import { useMemo, useState } from "react";
import { THEME } from "../../../commons/theme";
import { CONSTANTS } from "../../../commons/constants";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import { commitIntervalModifier } from "../../../services/calibration";
import { SettingSlider } from "../../../components/ui/SettingSlider";
import { StackedBarChart, type StackedBarChartSegment } from "../../../components/ui/StackedBarChart";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useNow } from "../../../hooks/useNow";
import { buildWorkloadForecast, seededRandom } from "../../../utils/workloadForecast.utils";
import { formatShortDate } from "../../../utils/time.utils";

const RANGE = CONSTANTS.srs.intervalModifier;
/** One seed for every position, so moving the slider changes the workload, not the dice. */
const FORECAST_SEED = 185;
const FORECAST_DAYS = 30;

// Bottom to top: the accent in steps, as the review forecast is.
const SEGMENTS: StackedBarChartSegment[] = [
    { key: 'scheduled', label: 'Scheduled', color: THEME.mastery.reading.loop1 },
    { key: 'projected', label: 'Projected', color: THEME.mastery.meaning.loop1 },
];

const roundStep = (value: number) => Math.round(value / RANGE.step) * RANGE.step;
const multiplierText = (value: number) => `×${value.toFixed(1)}`;
const count = (n: number) => Math.round(n).toLocaleString('en-US');

interface ReviewPacingProps {
    settings: UserSettings;
    progress: UserProgress | null;
    onUpdateSettings: (settings: UserSettings) => void;
}

/**
 * Review pacing: the interval modifier on a slider, and under it the workload it
 * buys, forecast from the learner's own queue and win rate. The forecast follows
 * the slider while it moves (debounced); the setting is written, and its history
 * appended, only when the slider is let go. Remounted (keyed by the value) when
 * the setting changes elsewhere, so the draft never shows a stale position.
 */
export function ReviewPacing({ settings, progress, onUpdateSettings }: ReviewPacingProps) {
    const [draft, setDraft] = useState(settings.intervalModifier);
    const candidate = useDebouncedValue(draft, 150);
    // Five minutes is fine-grained enough for a forecast in whole days.
    const now = useNow(5 * 60_000);

    const current = useMemo(
        () => progress && buildWorkloadForecast(progress, settings, new Date(now), seededRandom(FORECAST_SEED), FORECAST_DAYS),
        [progress, settings, now]
    );
    const atCandidate = useMemo(
        () => progress && (candidate === settings.intervalModifier
            ? current
            : buildWorkloadForecast(progress, { ...settings, intervalModifier: candidate }, new Date(now), seededRandom(FORECAST_SEED), FORECAST_DAYS)),
        [progress, settings, candidate, current, now]
    );

    const bars = useMemo(() => (atCandidate?.days ?? []).map((day, i) => ({
        label: String(day.date.getDate()),
        title: i === 0 ? 'Today' : formatShortDate(day.date),
        values: { scheduled: Math.round(day.scheduled), projected: Math.round(day.projected) },
    })), [atCandidate]);

    const commit = (value: number) => {
        const next = roundStep(value);
        if (next !== settings.intervalModifier) onUpdateSettings(commitIntervalModifier(settings, next, new Date()));
    };

    const changed = atCandidate !== null && current !== null && candidate !== settings.intervalModifier;

    return (
        <SettingSlider
            label="Intervals"
            valueText={multiplierText(draft)}
            ariaValueText={`Intervals ${multiplierText(draft)}`}
            description="Higher means longer gaps between reviews, and fewer of them. If your win rate drops too far, calibration pulls intervals back."
            value={draft}
            min={RANGE.min}
            max={RANGE.max}
            step={RANGE.step}
            onChange={(value) => setDraft(roundStep(value))}
            onCommit={commit}
        >
            {atCandidate && current && (
                <div className="mt-5 space-y-4">
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                            <dt className="type-label">Due now</dt>
                            <dd className="font-sans text-primary tabular-nums">
                                {count(atCandidate.dueNow)}
                                {changed && <span className="type-support">, currently {count(current.dueNow)}</span>}
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="type-label">A day, next {FORECAST_DAYS} days</dt>
                            <dd className="font-sans text-primary tabular-nums">
                                About {count(atCandidate.averagePerDay)}
                                {changed && <span className="type-support">, currently {count(current.averagePerDay)}</span>}
                            </dd>
                        </div>
                    </dl>
                    <StackedBarChart segments={SEGMENTS} bars={bars} height={120} showLegend />
                    <p className="type-support">
                        Scheduled reviews are already planned. Projected ones are what answering them at your recent win rate brings back, plus new words and grammar at your pace over the last two weeks. Vocabulary and grammar together.
                    </p>
                </div>
            )}
        </SettingSlider>
    );
}
