import { CONSTANTS } from "../commons/constants";
import type { CalibratedQuizType, UserProgress, UserSettings } from "../models/user.model";
import type { SRSEntry } from "../models/vocabulary.model";
import { growthLevelOf, recentWinRate } from "../services/calibration";
import {
    effectiveDueDate,
    isEntryMastered,
    isMeaningQuizEnabled,
    isProductionActivated,
    isProductionQuizEnabled,
    isReadingRelevant,
    isScheduled,
    newSRSEntry,
} from "../services/scheduling";
import { isGrammarFullyMastered } from "../services/grammarScheduling";
import { SRSService } from "../services/srs.service";

const DAY_MS = 24 * 60 * 60 * 1000;
/** New words arrive at the learner's own pace over this many days. */
const PACE_WINDOW_DAYS = 14;
/** A word's meaning review follows its intro's reading review by this much (applyVocabIntroChoice). */
const MEANING_STAGGER_MS = 12 * 60 * 60 * 1000;

export interface WorkloadDay {
    /** Midnight of the day. */
    date: Date;
    /** Reviews already planned, at their effective due dates (overdue ones on the first day). */
    scheduled: number;
    /** What answering them generates, plus new words at the learner's pace. Fractional: an expectation. */
    projected: number;
}

export interface WorkloadForecast {
    /** Reviews due right now. */
    dueNow: number;
    days: WorkloadDay[];
    /** Mean reviews a day across the window, scheduled and projected together. */
    averagePerDay: number;
}

export type WorkloadSettings = Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz' | 'intervalModifier' | 'intervalModifierHistory'>;

/**
 * A small deterministic generator (mulberry32): the forecast's simulated answers
 * come from it, so one seed always draws the same days.
 */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const EXPECTED_LATENCY: Record<CalibratedQuizType, number> = {
    reading: CONSTANTS.srs.quizProperties.reading.expectedLatency,
    meaning: CONSTANTS.srs.quizProperties.meaning_base.expectedLatency,
    production: CONSTANTS.srs.quizProperties.production.expectedLatency,
    grammar: CONSTANTS.srs.quizProperties.grammar.expectedLatency,
};

type ForecastProgress = Pick<UserProgress, 'learningQueue' | 'grammarQueue' | 'calibration'>;

/**
 * Every entry the forecast counts, with its quiz type: the relevance rules of
 * `buildReviewForecast` (no graduated or mastered entry, no disabled quiz type,
 * no reading for a word learned in kana, no production entry never activated).
 * The one walk behind the forecast and `hasScheduledReviews`.
 */
function plannedReviews(
    progress: ForecastProgress,
    settings: WorkloadSettings,
    visit: (entry: SRSEntry, type: CalibratedQuizType) => void
): void {
    const meaningOn = isMeaningQuizEnabled(settings);
    const productionOn = isProductionQuizEnabled(settings);
    const relevant = (entry: SRSEntry | undefined, type: CalibratedQuizType) => {
        if (entry && isScheduled(entry) && !isEntryMastered(entry)) visit(entry, type);
    };
    for (const v of progress.learningQueue) {
        if (v.stage === 'graduated') continue;
        if (isReadingRelevant(v)) relevant(v.reading, 'reading');
        if (meaningOn) relevant(v.meaning, 'meaning');
        if (productionOn && v.production && isProductionActivated(v.production)) relevant(v.production, 'production');
    }
    for (const g of progress.grammarQueue) {
        if (g.stage === 'graduated' || isGrammarFullyMastered(g)) continue;
        relevant(g.entry, 'grammar');
    }
}

/**
 * True when any review the forecast counts is planned, however far out. Tells a
 * learner with nothing scheduled from one whose reviews all fall past the window.
 */
export function hasScheduledReviews(progress: ForecastProgress, settings: WorkloadSettings): boolean {
    let any = false;
    plannedReviews(progress, settings, () => { any = true; });
    return any;
}

/**
 * The reviews a day to expect over the next `days` days at `settings`'s pacing,
 * from the learner's own progress. Shown under the pacing slider, computed for
 * the slider's position and for the current setting.
 *
 * Scheduled: every review already planned, at its effective due date under that
 * pacing (the queue's own `effectiveDueDate`), counted with the relevance rules
 * of `buildReviewForecast`: no graduated or mastered entry, no disabled quiz
 * type, no reading for a word learned in kana, no production entry never
 * activated. Exact, not estimated.
 *
 * Projected: each of those reviews is answered at the learner's recent win rate
 * for its quiz type, rescheduled through `SRSService.calculateNextState` (the one
 * formula) with the current calibration levels, and so on through the window.
 * New words and grammar points arrive at the pace of the last 14 days. Answers
 * are drawn from `random` (pass `seededRandom(seed)`), so the result is
 * deterministic for a seed.
 */
export function buildWorkloadForecast(
    progress: ForecastProgress,
    settings: WorkloadSettings,
    now: Date,
    random: () => number,
    days: number = 30
): WorkloadForecast {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dayStarts: number[] = [];
    for (let i = 0; i <= days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dayStarts.push(d.getTime());
    }
    const windowEnd = dayStarts[days];
    const result: WorkloadDay[] = dayStarts.slice(0, days).map(t => ({ date: new Date(t), scheduled: 0, projected: 0 }));

    const dayIndexOf = (t: number): number => {
        if (t < dayStarts[1]) return 0;
        let lo = 1, hi = days - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (dayStarts[mid] <= t) lo = mid; else hi = mid - 1;
        }
        return lo;
    };

    const modifier = settings.intervalModifier;
    const winRate = (type: CalibratedQuizType): number =>
        recentWinRate(progress.calibration?.[type]) ?? CONSTANTS.srs.formula.winRateTarget;

    /**
     * Follows one entry's reviews from `firstAt` through the window: the first is
     * `scheduled` or projected as asked, every later one is projected, each
     * weighted by `weight` (a fraction of a new word a day).
     */
    const follow = (start: SRSEntry, type: CalibratedQuizType, firstAt: number, firstIsScheduled: boolean, weight: number) => {
        let entry: SRSEntry = { ...start, history: [] };
        let at = Math.max(firstAt, now.getTime());
        let first = true;
        const p = winRate(type);
        const level = growthLevelOf(progress.calibration, type);
        const latency = EXPECTED_LATENCY[type];
        while (at < windowEnd) {
            const day = result[dayIndexOf(at)];
            if (first && firstIsScheduled) day.scheduled += weight;
            else day.projected += weight;
            first = false;
            const answer = random() < p ? 'correct' : 'wrong';
            // Scheduled at `at` under the slider's value, so it is due one interval on.
            entry = SRSService.calculateNextState(entry, answer, latency, new Date(at), latency, level, modifier).newEntry;
            if (isEntryMastered(entry)) return;
            at += entry.interval * DAY_MS;
        }
    };

    let dueNow = 0;
    plannedReviews(progress, settings, (entry, type) => {
        const due = effectiveDueDate(entry, settings);
        if (!due) return;
        if (due <= now) dueNow++;
        follow(entry, type, due.getTime(), true, 1);
    });

    const meaningOn = isMeaningQuizEnabled(settings);
    const paceSince = now.getTime() - PACE_WINDOW_DAYS * DAY_MS;
    const recent = (introductionAt: Date | null | undefined) =>
        !!introductionAt && introductionAt.getTime() > paceSince && introductionAt <= now;
    const newWords = progress.learningQueue.filter(v => recent(v.introductionAt)).length;
    const newGrammar = progress.grammarQueue.filter(g => recent(g.introductionAt)).length;

    // One representative word (and grammar point) a day, weighted by the pace:
    // the same expectation as simulating each, at a fraction of the cost.
    const wordsPerDay = newWords / PACE_WINDOW_DAYS;
    const grammarPerDay = newGrammar / PACE_WINDOW_DAYS;
    for (let i = 0; i < days; i++) {
        const introAt = Math.max(dayStarts[i] + DAY_MS / 2, now.getTime());
        if (wordsPerDay > 0) {
            follow(newSRSEntry(), 'reading', introAt, false, wordsPerDay);
            if (meaningOn) follow(newSRSEntry(), 'meaning', introAt + MEANING_STAGGER_MS, false, wordsPerDay);
        }
        if (grammarPerDay > 0) follow(newSRSEntry(), 'grammar', introAt, false, grammarPerDay);
    }

    const total = result.reduce((sum, d) => sum + d.scheduled + d.projected, 0);
    return { dueNow, days: result, averagePerDay: days > 0 ? total / days : 0 };
}

/** The busiest day's reviews, scheduled and projected together. */
export function highestDay(forecast: WorkloadForecast): number {
    return forecast.days.reduce((max, day) => Math.max(max, day.scheduled + day.projected), 0);
}

/**
 * True when there is nothing to forecast: no review planned or projected on any
 * day and none due now (a new learner, or no introductions lately and nothing
 * scheduled). Shown as one line rather than an empty chart.
 */
export function isEmptyForecast(forecast: WorkloadForecast): boolean {
    return forecast.dueNow === 0 && highestDay(forecast) === 0;
}
