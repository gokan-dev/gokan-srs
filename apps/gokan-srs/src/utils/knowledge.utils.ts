import { CONSTANTS } from "../commons/constants";
import type { UserSettings } from "../models/user.model";
import type { ReviewLog, SRSEntry, VocabProgress } from "../models/vocabulary.model";
import { calculateMasteryPercentage } from "./srs.utils";

const F = CONSTANTS.srs.formula;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Knowledge points" express one number - "how much Japanese does this user hold
 * right now" - that accumulates smoothly as items mature, instead of stepping only
 * when a word is first introduced. They back the knowledge curve, the per-answer
 * delta in the session ticker, and the session gains total.
 *
 * **One knowledge point is one mastery point.** `calculateMasteryPercentage`
 * already spans 0..200 across the MasteryRing's two visual loops, so an entry's
 * points ARE its mastery figure, unconverted: a fully-mastered SRS entry is worth
 * 200, and a word mastered in both reading and meaning is worth 400.
 *
 * This used to normalise to 0..100 per entry, which silently halved everything:
 * the ring advanced 6, the ticker printed "+6%", and the session total moved by 3.
 * Three places, three numbers, one underlying quantity. The scale is arbitrary, so
 * the one that removes every conversion is the right one to pick.
 */
export const KNOWLEDGE_POINTS_PER_ENTRY = 200;

/**
 * Points held by a single SRS entry at a given memory strength: its mastery figure
 * exactly (see above). Kept as a named function rather than inlining
 * calculateMasteryPercentage at each call site, so "knowledge points" stays a
 * concept the code can talk about.
 */
export function entryKnowledgePoints(memoryStrength: number): number {
    return calculateMasteryPercentage(memoryStrength);
}

/**
 * Reconstruct the memory strength an entry held immediately after a logged review.
 *
 * ReviewLog stores `interval`, not `memoryStrength`, so we invert the interval
 * formula from `SRSService.calculateNextState`:
 *
 *     interval = strength * lnTarget * adaptiveModifier * frequencyModifier
 *
 * followed by result-specific post-processing (wrong x0.3 with a 0.5d floor,
 * minor_error x0.7) and a 1-day floor on success.
 *
 * The result multiplier is undone exactly, since `result` is logged. Two sources
 * of approximation remain:
 *  - the adaptive interval modifier in force at review time is not logged
 *  - where a floor clamped the interval, the pre-clamp value is unrecoverable, so
 *    very weak entries come out slightly over-estimated
 *
 * Both distort only the bottom of the curve, where an entry is worth a handful of
 * points; the trend this graph exists to show (steady growth vs. stagnation) is
 * unaffected.
 */
export function strengthFromLog(log: ReviewLog, frequencyModifier = 1): number {
    let interval = log.interval;

    if (log.result === 'wrong') {
        interval /= F.postProcessIntervalMultipliers.wrong;
    } else if (log.result === 'minor_error') {
        interval /= F.postProcessIntervalMultipliers.minor_error;
    }

    const strength = interval / (F.lnTarget * (frequencyModifier || 1));
    return Math.min(Math.max(strength, F.minMemoryStrength), F.mastery.maxMemoryStrength);
}

interface KnowledgeEvent {
    /** Epoch ms at which the entry's point value changed. */
    t: number;
    /** Points held by the entry from this moment until the next event. */
    p: number;
}

/**
 * The point-value timeline for one SRS entry, oldest first.
 *
 * Note that `SRSEntry.history` is capped at the last 20 reviews, so for a heavily
 * reviewed item the earliest logs are gone. Such an entry's timeline therefore
 * starts at whatever it was worth 20 reviews ago rather than at zero, which
 * slightly front-loads knowledge for mature words. It only affects words that are
 * near mastery anyway, and only in the oldest part of the window.
 */
function entryEvents(
    entry: SRSEntry,
    introductionAt: Date | null,
    frequencyModifier: number,
    /**
     * Whether an entry with no review history may still be credited at the word's
     * introduction date (see below). True for reading and meaning; decided per word
     * for production, which the migration can hand a mastered entry that was never
     * actually reviewed.
     */
    allowNoHistoryCredit = true
): KnowledgeEvent[] {
    if (entry.history && entry.history.length > 0) {
        return entry.history
            .map(log => ({
                t: new Date(log.date).getTime(),
                p: entryKnowledgePoints(strengthFromLog(log, frequencyModifier)),
            }))
            .sort((a, b) => a.t - b.t);
    }

    // No history: either an item skipped at intro ("I already know this", set
    // straight to max strength) or one introduced but not yet reviewed. Credit it
    // at its introduction date using its actual strength - the latter is worth 0
    // points, so only genuine skips move the curve.
    if (allowNoHistoryCredit && introductionAt) {
        const points = entryKnowledgePoints(entry.memoryStrength);
        if (points > 0) return [{ t: new Date(introductionAt).getTime(), p: points }];
    }

    return [];
}

function startOfDay(t: number): number {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** Whole days between two day-starts, DST-safe (a DST day is 23 or 25 hours). */
function daysBetween(fromDayStart: number, toDayStart: number): number {
    return Math.round((toDayStart - fromDayStart) / DAY_MS);
}

export interface KnowledgeCurvePoint {
    date: Date;
    /** Total knowledge points held at the end of this day. */
    points: number;
    /** Points gained (or lost, after failures) during this day. */
    gain: number;
}

export interface KnowledgeCurve {
    points: KnowledgeCurvePoint[];
    /** Points held today - the last point on the curve. */
    currentTotal: number;
    /** Points gained across the whole window. */
    gained: number;
    /** Mean daily gain across the window. */
    averagePerDay: number;
    /** Gain on the best single day in the window. */
    bestDayGain: number;
    /** Days in the window with no gain at all - the stagnation signal. */
    flatDays: number;
}

export type KnowledgeCurveRange = number | 'all';

export interface BuildKnowledgeCurveOptions {
    /** Window length in days, or 'all' to start at the earliest recorded event. */
    range: KnowledgeCurveRange;
    now?: Date;
    settings?: UserSettings;
}

/**
 * Build the cumulative knowledge curve over a time window.
 *
 * Rather than evaluating every entry on every day (O(entries x days)), each entry
 * contributes only the *changes* in its point value to the day they happened on;
 * a prefix sum over those daily deltas then yields the running total. Events that
 * predate the window collapse into a single starting baseline.
 */
export function buildKnowledgeCurve(
    queue: VocabProgress[],
    options: BuildKnowledgeCurveOptions
): KnowledgeCurve {
    const nowMs = (options.now ?? new Date()).getTime();
    const todayStart = startOfDay(nowMs);

    const frequencyModifier = options.settings?.learningFrequency
        ? CONSTANTS.srs.frequencyMultipliers[options.settings.learningFrequency]
        : 1;

    const series: KnowledgeEvent[][] = [];
    let earliest = Infinity;

    for (const vocab of queue) {
        // Production counts alongside reading and meaning: it is a real direction the
        // learner studies, and leaving it out meant a production answer moved the
        // session total while the curve ignored it.
        //
        // Its no-history entries need care, though, which is the one asymmetry here.
        // The migration grandfathers every already-graduated word to production-
        // mastered so it does not un-graduate (see Production quiz rollout), and those
        // entries carry no review logs. Crediting them through the no-history fallback
        // would date ~200 points at each word's introduction and rewrite years of curve
        // the learner never earned that way.
        //
        // The fallback is allowed only when the word has never been reviewed at all,
        // which is exactly the "skipped at intro" case the fallback exists for: there
        // the learner asserted they already knew the word, reading and meaning are
        // credited on the same basis, and production is no different. A word with real
        // review history instead waits for a real production review before counting.
        const productionNoHistoryCredit = vocab.totalReviews === 0;

        for (const [entry, allowNoHistoryCredit] of [
            [vocab.reading, true],
            [vocab.meaning, true],
            [vocab.production, productionNoHistoryCredit],
        ] as const) {
            if (!entry) continue;
            const events = entryEvents(entry, vocab.introductionAt, frequencyModifier, allowNoHistoryCredit);
            if (events.length === 0) continue;
            series.push(events);
            if (events[0].t < earliest) earliest = events[0].t;
        }
    }

    // Step the window start back by calendar days rather than subtracting
    // N * DAY_MS: across a DST boundary a fixed-millisecond offset lands an hour
    // into the neighbouring day and would yield a window one day too long.
    let normalisedStart: number;
    if (options.range === 'all') {
        // Clamped to today: if every recorded event is future-dated (clock skew on
        // another synced device) the window must still be a valid, non-empty range.
        normalisedStart = earliest === Infinity
            ? todayStart
            : Math.min(startOfDay(earliest), todayStart);
    } else {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - (Math.max(1, options.range) - 1));
        normalisedStart = start.getTime();
    }

    const dayCount = Math.max(1, daysBetween(normalisedStart, todayStart) + 1);

    let baseline = 0;
    const deltas = new Array<number>(dayCount).fill(0);

    for (const events of series) {
        let previousPoints = 0;
        for (const event of events) {
            // Defensive: a clock-skewed or synced-from-the-future log must not
            // extend the curve past today.
            if (event.t > nowMs) continue;

            const dayIndex = daysBetween(normalisedStart, startOfDay(event.t));
            const delta = event.p - previousPoints;

            if (dayIndex < 0) baseline += delta;
            else if (dayIndex < dayCount) deltas[dayIndex] += delta;

            previousPoints = event.p;
        }
    }

    // Days before the user had any knowledge at all aren't "stagnation" - they're
    // days that predate them starting. Only count flat days from the point the
    // window actually becomes active.
    const firstActiveDay = baseline > 0 ? 0 : deltas.findIndex(d => d !== 0);

    const points: KnowledgeCurvePoint[] = [];
    let running = baseline;
    let bestDayGain = 0;
    let flatDays = 0;

    for (let i = 0; i < dayCount; i++) {
        running += deltas[i];

        const date = new Date(normalisedStart);
        date.setDate(date.getDate() + i);

        points.push({ date, points: Math.max(0, running), gain: deltas[i] });

        if (deltas[i] > bestDayGain) bestDayGain = deltas[i];
        if (deltas[i] <= 0 && firstActiveDay >= 0 && i >= firstActiveDay) flatDays++;
    }

    const currentTotal = points[points.length - 1].points;
    const gained = currentTotal - Math.max(0, baseline);

    return {
        points,
        currentTotal,
        gained,
        averagePerDay: gained / dayCount,
        bestDayGain,
        flatDays,
    };
}
