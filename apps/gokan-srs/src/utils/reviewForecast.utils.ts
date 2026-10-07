import type { SRSEntry, VocabProgress } from "../models/vocabulary.model";
import type { UserSettings } from "../models/user.model";
import {
    isEntryMastered,
    isMeaningQuizEnabled,
    isProductionActivated,
    isProductionQuizEnabled,
    isReadingRelevant,
} from "../services/scheduling";

export interface ReviewForecastBucket {
    label: string;
    /** Midnight of the bucket's day, or `now` for the two same-day buckets. */
    date: Date;
    reading: number;
    meaning: number;
    production: number;
}

/**
 * Buckets every scheduled vocab review into Now / Later (today) / one bucket per
 * following day. Relevance is decided the way the scheduler decides it
 * (services/scheduling.ts), so the chart cannot report work the session would
 * never serve: meaning is skipped when meaning quizzes are off, production when
 * production quizzes are off or the entry was never activated, and any entry
 * already mastered is skipped whatever its stored due date says.
 */
export function buildReviewForecast(
    queue: VocabProgress[],
    settings: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'> | undefined,
    now: Date,
    daysToShow: number = 7
): ReviewForecastBucket[] {
    const buckets: ReviewForecastBucket[] = [
        { label: 'Now', date: now, reading: 0, meaning: 0, production: 0 },
        { label: 'Later', date: now, reading: 0, meaning: 0, production: 0 },
    ];

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i < daysToShow; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const label = i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
        buckets.push({ label, date: d, reading: 0, meaning: 0, production: 0 });
    }

    const place = (entry: SRSEntry, type: 'reading' | 'meaning' | 'production') => {
        if (!entry.dueDate || isEntryMastered(entry)) return;
        const due = new Date(entry.dueDate);

        if (due <= now) {
            buckets[0][type]++;
            return;
        }

        const dueDay = new Date(due);
        dueDay.setHours(0, 0, 0, 0);
        if (dueDay.getTime() === today.getTime()) {
            buckets[1][type]++;
            return;
        }

        const bucket = buckets.slice(2).find(b => b.date.getTime() === dueDay.getTime());
        if (bucket) bucket[type]++;
    };

    const meaningOn = isMeaningQuizEnabled(settings);
    const productionOn = isProductionQuizEnabled(settings);

    for (const v of queue) {
        // Graduated items may carry a legacy stale dueDate.
        if (v.stage === 'graduated') continue;
        // A word learned in kana is never asked its reading, whatever the entry holds.
        if (isReadingRelevant(v)) place(v.reading, 'reading');
        if (meaningOn) place(v.meaning, 'meaning');
        if (productionOn && v.production && isProductionActivated(v.production)) place(v.production, 'production');
    }

    return buckets;
}
