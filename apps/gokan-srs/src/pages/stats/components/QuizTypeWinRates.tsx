import { useMemo } from "react";
import type { CalibratedQuizType, UserProgress } from "../../../models/user.model";
import { CALIBRATED_QUIZ_TYPES } from "../../../models/user.model";
import { recentWinRate, withCalibrationDefaults } from "../../../services/calibration";
import { percentOf, winRatesByQuizType } from "../../../utils/winRate.utils";
import { Disclosure } from "../../../components/ui/Disclosure";
import { CONSTANTS } from "../../../commons/constants";

const LABELS: Record<CalibratedQuizType, string> = {
    reading: "Reading",
    meaning: "Meaning",
    production: "Production",
    grammar: "Grammar",
};

interface QuizTypeWinRatesProps {
    progress: UserProgress;
}

/**
 * Recall rate per quiz type, next to what the calibration does with it: the recent
 * window of real reviews each type calibrates on, and the resulting growth level
 * (x1.00 = the base rate; above 1, strength grows faster because this type's
 * reviews keep succeeding; below 1, slower).
 */
export function QuizTypeWinRates({ progress }: QuizTypeWinRatesProps) {
    const rows = useMemo(() => {
        const { byType } = winRatesByQuizType(progress);
        const calibration = withCalibrationDefaults(progress.calibration);
        return CALIBRATED_QUIZ_TYPES.map(type => {
            const recent = recentWinRate(calibration[type]);
            return {
                type,
                allTime: percentOf(byType[type]),
                allTimeCount: byType[type].answers,
                recent: recent === null ? null : Math.round(recent * 100),
                recentCount: calibration[type].history.length,
                level: calibration[type].level,
            };
        });
    }, [progress]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full font-sans text-sm tabular-nums">
                <thead>
                    <tr className="text-left text-secondary border-b border-divider">
                        <th className="py-2 pr-4 font-medium">Quiz</th>
                        <th className="py-2 pr-4 font-medium">All answers</th>
                        <th className="py-2 font-medium">Last {CONSTANTS.srs.adaptive.historySize}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.type} className="border-b border-divider last:border-0">
                            <td className="py-2 pr-4 text-primary">{LABELS[row.type]}</td>
                            <td className="py-2 pr-4 text-primary">
                                {row.allTime === null ? "-" : `${row.allTime}%`}
                                <span className="type-meta ml-1.5">{row.allTimeCount.toLocaleString('en-US')}</span>
                            </td>
                            <td className="py-2 text-primary">
                                {row.recent === null ? "-" : `${row.recent}%`}
                                <span className="type-meta ml-1.5">{row.recentCount}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <Disclosure title="How scheduling adapts" className="mt-3">
                <p className="type-support mb-2">
                    Reviews are scheduled for about 75% recall. Each quiz type calibrates on its own recent reviews
                    (retries and first reviews excluded): above 80%, its strength grows faster so intervals lengthen;
                    below 70%, slower.
                </p>
                <ul className="type-support space-y-1">
                    {rows.map(row => (
                        <li key={row.type}>{LABELS[row.type]}: ×{row.level.toFixed(2)} growth</li>
                    ))}
                </ul>
            </Disclosure>
        </div>
    );
}
