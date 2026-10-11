import { CONSTANTS } from "../commons/constants";
import type { SRSEntry } from "../models/vocabulary.model";
import { calculateMasteryLoops } from "./srs.utils";

export interface CurvePoint {
    date: number;
    /** Learning mastery (loop 1), 0 to 100. */
    percent: number;
}

/**
 * The learning curve of one direction, as mastery over time. A review log keeps
 * the interval it set, not the strength, so each point reads the strength back
 * off the interval (interval = strength x lnTarget, at the default frequency):
 * a close reading of what the ring showed after that review. It starts at 0 on
 * the introduction date and ends at the entry's current strength now.
 */
export function learningCurve(entry: SRSEntry, introducedAt: Date | null, now: number): CurvePoint[] {
    const lnTarget = CONSTANTS.srs.formula.lnTarget;
    const points: CurvePoint[] = [];
    if (introducedAt) points.push({ date: introducedAt.getTime(), percent: 0 });
    for (const log of [...entry.history].sort((a, b) => a.date - b.date)) {
        points.push({ date: log.date, percent: calculateMasteryLoops(log.interval / lnTarget).p1 });
    }
    points.push({ date: now, percent: calculateMasteryLoops(entry.memoryStrength).p1 });
    return points;
}
