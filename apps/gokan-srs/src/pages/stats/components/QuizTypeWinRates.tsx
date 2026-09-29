import { useMemo } from "react";
import type { CalibratedQuizType, UserProgress } from "../../../models/user.model";
import { CALIBRATED_QUIZ_TYPES } from "../../../models/user.model";
import { recentWinRate, withCalibrationDefaults } from "../../../services/calibration";
import { percentOf, winRatesByQuizType } from "../../../utils/winRate.utils";

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
 * Win rate per quiz type, next to what the calibration does with it: the recent
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
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-secondary border-b border-divider">
                        <th className="py-2 pr-4 font-medium">Quiz</th>
                        <th className="py-2 pr-4 font-medium">All reviews</th>
                        <th className="py-2 pr-4 font-medium">Recent</th>
                        <th className="py-2 font-medium">Growth</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.type} className="border-b border-divider last:border-0">
                            <td className="py-2 pr-4 text-primary">{LABELS[row.type]}</td>
                            <td className="py-2 pr-4 text-primary">
                                {row.allTime === null ? "-" : `${row.allTime}%`}
                                <span className="text-tertiary text-xs ml-1">({row.allTimeCount})</span>
                            </td>
                            <td className="py-2 pr-4 text-primary">
                                {row.recent === null ? "-" : `${row.recent}%`}
                                <span className="text-tertiary text-xs ml-1">({row.recentCount})</span>
                            </td>
                            <td className="py-2 text-primary">×{row.level.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="text-xs text-tertiary mt-3">
                Reviews are scheduled for about 75% recall. Each quiz type calibrates on its own recent reviews
                (retries and first reviews excluded): above 80%, its strength grows faster so intervals lengthen;
                below 70%, slower.
            </p>
        </div>
    );
}
