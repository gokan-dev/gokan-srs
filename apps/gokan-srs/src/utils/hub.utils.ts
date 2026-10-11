import { formatDurationUntil } from "./time.utils";

/** What an activity has waiting, as the hub previews it. */
export interface ActivityWork {
    review: number;
    new: number;
    retries: number;
}

export type HubActivity = 'vocab' | 'grammar';

const hasWork = (work: ActivityWork) => work.review + work.new + work.retries > 0;

/**
 * The hub's one primary button: the first activity in order (vocabulary, then
 * grammar) with reviews, retries or new items. With no work anywhere there is
 * none, and both buttons are secondary.
 */
export function hubPrimaryActivity(vocab: ActivityWork, grammar: ActivityWork): HubActivity | null {
    if (hasWork(vocab)) return 'vocab';
    if (hasWork(grammar)) return 'grammar';
    return null;
}

/**
 * The hub's subtitle: "43 reviews due", or once nothing is due "All caught up.
 * Next review in 2 h 15 min." (the earliest of the given dates, when there is one).
 */
export function hubSummary(reviewsDue: number, nextReviews: (Date | null)[], now: number): string {
    if (reviewsDue > 0) return `${reviewsDue.toLocaleString('en-US')} review${reviewsDue === 1 ? '' : 's'} due`;
    const next = nextReviews
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
    return next ? `All caught up. Next review in ${formatDurationUntil(next, now)}.` : 'All caught up.';
}
