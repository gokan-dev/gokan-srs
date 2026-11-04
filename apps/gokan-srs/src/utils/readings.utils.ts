/**
 * Between a word's readings on the intro card's reading row (WordReading) and the reading quiz's
 * reveal (formatReadingList). The word page's "Also:" line joins its alternatives with 、 instead,
 * inside a Japanese run.
 */
export const READING_SEPARATOR = ', ';

/** A word's readings in the order they are listed: its primary, then its alternatives. */
export function readingList(reading: { primary: string; alternatives: string[] }): string[] {
    return [reading.primary, ...reading.alternatives];
}
