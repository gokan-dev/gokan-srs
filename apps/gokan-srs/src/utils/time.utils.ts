const MINUTE_MS = 60_000;

/**
 * The one place dates are formatted, all in `en-US` because the UI's copy is
 * English: a `toLocaleDateString()` call with no locale follows the browser's
 * locale instead, which is how the same screen used to mix "14 juil.",
 * "19/04/2026" and English weekday labels depending on where it ran.
 */

/** "Apr 19, 2026". */
export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Oct 11": a date without its year, for charts and lists where the year rarely matters. */
export function formatShortDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Apr 19, 2026, 6:59 AM". */
export function formatDateTime(date: Date): string {
    return `${formatDate(date)}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** "Mon": the three-letter weekday used by the activity and forecast charts. */
export function formatWeekday(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Whole minutes until `date`, rounded up and never below 1: "in 1 minute" covers anything imminent. */
export function minutesUntil(date: Date, now: number): number {
    return Math.max(1, Math.ceil((date.getTime() - now) / MINUTE_MS));
}

/** "5 minutes", "1 minute". */
export function formatMinutes(minutes: number): string {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/** A compact countdown for a review date: "Now", "in 5 min", "in 3 h", "in 2 d", then the date itself. */
export function formatTimeUntil(date: Date | null, now: number): string {
    if (!date) return '-';

    const diffMs = date.getTime() - now;
    if (diffMs <= 0) return 'Now';

    const minutes = Math.floor(diffMs / MINUTE_MS);
    if (minutes < 60) return `in ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `in ${days} d`;

    return formatDate(date);
}
