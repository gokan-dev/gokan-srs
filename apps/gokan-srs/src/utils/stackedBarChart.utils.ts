/**
 * Flexbox lays out `flex-col` children top to bottom in DOM order; `justify-end`
 * then anchors the whole group to the container's bottom edge. So a bar drawn
 * "bottom segment first" needs that bottom segment LAST in the DOM. The
 * previous three chart copies used `flex-col-reverse` with `justify-end`
 * instead, which reverses which edge "end" means and packs every bar at the
 * TOP of its track - this is what rendering `segmentsBottomToTop` in reverse
 * fixes, without resorting to `flex-col-reverse`.
 */
export function stackedBarDomOrder<T>(segmentsBottomToTop: T[]): T[] {
    return [...segmentsBottomToTop].reverse();
}

/** A segment's height as a percentage of the chart's max value, clamped to [0, 100]. */
export function segmentHeightPercent(value: number, maxValue: number): number {
    if (maxValue <= 0) return 0;
    return Math.min(100, Math.max(0, (value / maxValue) * 100));
}

/** The y-axis labels, top to bottom: the max, a midline when it is a distinct whole number, and 0. */
export function axisTicks(maxValue: number): number[] {
    const max = Math.max(1, Math.ceil(maxValue));
    const mid = Math.round(max / 2);
    return mid > 0 && mid < max ? [max, mid, 0] : [max, 0];
}

/**
 * Whether bar `index`'s label shows on a narrow screen: with many bars, every
 * other one counting back from the last (today), and every fifth for a month of
 * bars (the pacing forecast), so labels never collide or truncate. All of them
 * show from `md` up.
 */
export function showsLabelWhenNarrow(index: number, count: number): boolean {
    const every = count <= 10 ? 1 : count <= 20 ? 2 : 5;
    return (count - 1 - index) % every === 0;
}

/** Which edge of its bar a tooltip lines up with. */
export type TooltipAnchor = 'start' | 'center' | 'end';

/**
 * Where bar `index`'s tooltip sits: centred over the bar in the middle third,
 * and from the bar's outer edge in the first and last third, so the tooltip of
 * a thin bar near the chart's edge (a month of bars at 320px) opens inward
 * instead of past the screen.
 */
export function tooltipAnchor(index: number, count: number): TooltipAnchor {
    if (count <= 1) return 'center';
    if (index < count / 3) return 'start';
    if (index >= count - count / 3) return 'end';
    return 'center';
}
