/**
 * Returns a copy of `items` with `item` inserted `fraction` (0..1) of the way through.
 * The reducers use it to slot a word or grammar point added from a detail page in
 * among the intro candidates; the caller supplies the fraction (typically random) so
 * the reducers themselves stay deterministic.
 */
export function insertAtFraction<T>(items: readonly T[], item: T, fraction: number): T[] {
    const clamped = Math.min(Math.max(fraction, 0), 1);
    const index = Math.min(Math.floor(clamped * (items.length + 1)), items.length);
    return [...items.slice(0, index), item, ...items.slice(index)];
}
