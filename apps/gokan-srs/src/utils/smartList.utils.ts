/** Sorting for the Stats screen's item lists (components/SmartList.tsx). */

/** What every studied item's progress has, vocab or grammar alike. */
export interface ListedProgress {
    stage: 'learning' | 'graduated';
    introductionAt: Date | null;
    nextReviewAt: Date | null;
}

/** One entry of the sort menu: the value to sort by, ascending. */
export interface SortOption<S extends string, P, I> {
    value: S;
    label: string;
    sortKey: (progress: P, item: I | undefined) => number;
}

/** The sort options every list offers, from the progress alone. */
export function commonSortOptions<P extends ListedProgress, I>(failuresOf: (progress: P) => number): SortOption<'added_date' | 'next_review' | 'srs_stage' | 'failures', P, I>[] {
    return [
        { value: 'added_date', label: 'Date Added', sortKey: p => p.introductionAt?.getTime() ?? 0 },
        { value: 'next_review', label: 'Next Review', sortKey: p => p.nextReviewAt?.getTime() ?? Number.MAX_SAFE_INTEGER },
        { value: 'srs_stage', label: 'SRS Stage', sortKey: p => (p.stage === 'graduated' ? 1 : 0) },
        { value: 'failures', label: 'Failure Count', sortKey: failuresOf },
    ];
}
