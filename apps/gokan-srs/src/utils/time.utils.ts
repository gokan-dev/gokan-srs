const MINUTE_MS = 60_000;

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

    return date.toLocaleDateString();
}
