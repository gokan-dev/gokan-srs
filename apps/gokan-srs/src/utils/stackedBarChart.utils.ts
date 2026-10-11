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
