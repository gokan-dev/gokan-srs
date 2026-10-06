/** How much of a set of items (a JLPT level, a chapter) the learner has covered. */
export interface CoverageCounts {
    mastered: number;
    /** Started but not mastered. */
    learning: number;
    /** Every item in the set; the untouched ones are total - mastered - learning. */
    total: number;
}

export type CoverageStatus = 'mastered' | 'learning';

/**
 * Tallies `ids` by their status. `statusOf` returns undefined for an item the learner
 * has not started; every coverage figure in the app (JLPT levels, chapters) counts
 * through this, so they can never disagree about what "covered" means.
 */
export function coverageOf(ids: readonly string[], statusOf: (id: string) => CoverageStatus | undefined): CoverageCounts {
    let mastered = 0;
    let learning = 0;
    for (const id of ids) {
        const status = statusOf(id);
        if (status === 'mastered') mastered++;
        else if (status === 'learning') learning++;
    }
    return { mastered, learning, total: ids.length };
}

/** A lookup of each started item's status, built once so a tally is not a scan per item. */
export function statusIndex<T>(
    items: readonly T[],
    idOf: (item: T) => string,
    statusOfItem: (item: T) => CoverageStatus | undefined,
): (id: string) => CoverageStatus | undefined {
    const statuses = new Map<string, CoverageStatus>();
    for (const item of items) {
        const status = statusOfItem(item);
        if (status) statuses.set(idOf(item), status);
    }
    return id => statuses.get(id);
}
