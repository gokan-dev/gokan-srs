/** A tab's extent along a scrolling row, in the row's content coordinates (0 is the content's start). */
export interface TabSpan {
    left: number;
    right: number;
}

/** A scrolling tab row, measured: its tabs, its visible width and its inline padding (px). */
export interface TabRow {
    tabs: readonly TabSpan[];
    /** The visible width (clientWidth). */
    width: number;
    /** The furthest it scrolls (scrollWidth - clientWidth). */
    maxScroll: number;
    paddingLeft: number;
    paddingRight: number;
    gap: number;
}

/**
 * How much of a tab must show, and stay hidden, at the row's edge (px) for it to read as cut by
 * the edge, the cue that the row scrolls on. Small enough that a row of short tabs on a 320px
 * phone still has a scroll position cutting a tab at both edges.
 */
export const NEIGHBOUR_SLICE = 6;

/**
 * How far from the row's edge the open tab is kept: its padding (the page inset a row bled to the
 * screen's edges pads back), plus the gap, plus a slice of the next tab. It must exceed padding
 * plus gap: at exactly that (16px + 16px on a phone) the next tab starts on the screen's edge,
 * hidden whole, and nothing shows the row goes on.
 */
export function keepInViewMargin(padding: number, gap: number): number {
    return padding + gap + NEIGHBOUR_SLICE;
}

/** Whether, scrolled to `at`, each edge with tabs past it cuts one, a slice of it on each side. */
function edgesCut(row: TabRow, at: number): boolean {
    const end = at + row.width;
    const hiddenLeft = row.tabs.some(tab => tab.left < at - 0.5);
    const hiddenRight = row.tabs.some(tab => tab.right > end + 0.5);
    const cutLeft = row.tabs.some(tab => tab.left <= at - NEIGHBOUR_SLICE && tab.right >= at + NEIGHBOUR_SLICE);
    const cutRight = row.tabs.some(tab => tab.left <= end - NEIGHBOUR_SLICE && tab.right >= end + NEIGHBOUR_SLICE);
    return (!hiddenLeft || cutLeft) && (!hiddenRight || cutRight);
}

/**
 * Where a scrolling tab row scrolls to show its open tab (`open`, an index), from `from`: the
 * nearest position that keeps the open tab `keepInViewMargin` from either edge (the first and last
 * tabs rest at the row's ends, inside its padding), then, if an edge would fall in a gap between
 * two tabs with more behind it, the nearest one that still shows the open tab inside the padding
 * and cuts a tab at each edge that has tabs past it. A gap on the edge hides the next tab whole:
 * the margin alone guards the open tab's side only, not the far edge.
 */
export function tabRowScroll(row: TabRow, open: number, from: number): number {
    const tab = row.tabs[open];
    if (tab === undefined) return from;
    const clamp = (at: number) => Math.min(row.maxScroll, Math.max(0, at));
    const leftMargin = keepInViewMargin(row.paddingLeft, row.gap);
    const rightMargin = keepInViewMargin(row.paddingRight, row.gap);
    let target = from;
    if (tab.left < from + leftMargin) target = tab.left - leftMargin;
    else if (tab.right > from + row.width - rightMargin) target = tab.right - row.width + rightMargin;
    target = clamp(target);
    const shows = (at: number) => tab.left >= at + row.paddingLeft - 0.5 && tab.right <= at + row.width - row.paddingRight + 0.5;
    for (let step = 0; step <= row.width; step++) {
        for (const at of step === 0 ? [target] : [target + step, target - step]) {
            if (at < 0 || at > row.maxScroll) continue;
            if (shows(at) && edgesCut(row, at)) return at;
        }
    }
    return target;
}
