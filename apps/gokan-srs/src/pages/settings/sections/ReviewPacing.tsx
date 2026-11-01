import { useMemo, useState } from "react";
import { THEME } from "../../../commons/theme";
import { CONSTANTS } from "../../../commons/constants";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import { commitIntervalModifier } from "../../../services/calibration";
import { SettingSlider } from "../../../components/ui/SettingSlider";
import { StackedBarChart, type StackedBarChartSegment } from "../../../components/ui/StackedBarChart";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useNow } from "../../../hooks/useNow";
import { buildWorkloadForecast, highestDay, isEmptyForecast, seededRandom } from "../../../utils/workloadForecast.utils";
import { formatShortDate } from "../../../utils/time.utils";

const RANGE = CONSTANTS.srs.intervalModifier;
/** One seed for every position, so moving the slider changes the workload, not the dice. */
const FORECAST_SEED = 185;
const FORECAST_DAYS = 30;

// Bottom to top: the accent in steps, under names that claim no quiz direction.
const SEGMENTS: StackedBarChartSegment[] = [
    { key: 'scheduled', label: 'Scheduled', color: THEME.accentStep.full },
    { key: 'projected', label: 'Projected', color: THEME.accentStep.mid },
];

// To the step, and to one decimal: 7 x 0.1 is 0.7000000000000001, which would be stored as is.
const roundStep = (value: number) => Number((Math.round(value / RANGE.step) * RANGE.step).toFixed(1));
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
 * appended, only when the slider is let go (its native `change`: a release, a key
 * step, an assistive-tech adjustment). Never remounted by a commit, so a keyboard
 * keeps its focus from one step to the next. When the setting changes from
 * somewhere else (a Drive merge, another commit), the draft follows it, adjusted
 * during render rather than in an effect, so it never shows a stale position.
 */
export function ReviewPacing({ settings, progress, onUpdateSettings }: ReviewPacingProps) {
    const [draft, setDraft] = useState(settings.intervalModifier);
    const [seen, setSeen] = useState(settings.intervalModifier);
    if (seen !== settings.intervalModifier) {
        setSeen(settings.intervalModifier);
        setDraft(settings.intervalModifier);
    }
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
    // One scale for both positions, so the bars shrink as intervals lengthen rather than the axis.
    const maxValue = current && atCandidate ? Math.max(1, highestDay(current), highestDay(atCandidate)) : undefined;

    return (
        <SettingSlider
            label="Intervals"
            valueText={multiplierText(draft)}
            ariaValueText={`Intervals ${multiplierText(draft)}`}
            description="Higher means longer gaps between reviews, and fewer of them. If you start missing more reviews, intervals shorten again on their own."
            value={draft}
            min={RANGE.min}
            max={RANGE.max}
            step={RANGE.step}
            onChange={(value) => setDraft(roundStep(value))}
            onCommit={commit}
        >
            {current && isEmptyForecast(current) && (
                <p className="mt-4 type-support">The forecast appears once you have reviews scheduled.</p>
            )}
            {atCandidate && current && !isEmptyForecast(current) && (
                <div className="mt-5 space-y-4" data-pacing-forecast>
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                            <dt className="type-label">Due now</dt>
                            <dd className="type-body tabular-nums">
                                {count(atCandidate.dueNow)}
                                {changed && <span className="block type-support">currently {count(current.dueNow)}</span>}
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="type-label">Daily average</dt>
                            <dd className="type-body tabular-nums">
                                About {count(atCandidate.averagePerDay)}
                                {changed && <span className="block type-support">currently {count(current.averagePerDay)}</span>}
                            </dd>
                        </div>
                    </dl>
                    <StackedBarChart segments={SEGMENTS} bars={bars} height={120} maxValue={maxValue} showLegend />
                    <p className="type-support">
                        Reviews a day over the next {FORECAST_DAYS} days. Scheduled reviews are already planned. Projected ones are what answering them at your recent win rate brings back, plus new words and grammar at your pace over the last two weeks. Vocabulary and grammar together.
                    </p>
                </div>
            )}
        </SettingSlider>
    );
}
