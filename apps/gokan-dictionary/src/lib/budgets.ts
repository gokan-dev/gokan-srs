// The dictionary's size budgets (docs/DESIGN_SYSTEM.md, Dictionary): what each page type and asset
// may weigh, checked after every build by scripts/check-build.ts, which fails the build when one
// is exceeded. A budget is a decision about what the site costs a reader on a phone; raise one
// deliberately, in the docs, never to make a build pass.

const KB = 1024;

export const BUDGETS = {
    /** A word page, 90th percentile. */
    wordPageP90: 20 * KB,
    /** The heaviest kanji page (一 lists 660 words). */
    kanjiPageMax: 80 * KB,
    grammarIndex: 150 * KB,
    /** Each page of a JLPT word list. */
    jlptPage: 150 * KB,
    /** The stylesheet every page loads. */
    sharedStylesheet: 10 * KB,
    /** The search script every page loads. */
    searchScript: 10 * KB,
    /** The query engine it loads on first focus, with the index. */
    searchEngine: 10 * KB,
    /** search-core.json, gzipped. */
    searchCoreGzip: 300 * KB,
    /** The one web font. */
    webFont: 40 * KB,
} as const;

export type BudgetName = keyof typeof BUDGETS;

export interface Measurement {
    budget: BudgetName;
    /** What was measured, for the report: a file or a page. */
    subject: string;
    bytes: number;
}

/** The value at percentile `p` (0 to 100) of `values`, nearest rank; 0 for none. */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function overBudget(measurements: Measurement[]): Measurement[] {
    return measurements.filter(m => m.bytes > BUDGETS[m.budget]);
}

/** "12.3 KB of 20 KB": one report line's figures. */
export function describe(measurement: Measurement): string {
    const kb = (bytes: number) => `${(bytes / KB).toFixed(1).replace(/\.0$/, '')} KB`;
    return `${measurement.budget}: ${measurement.subject} ${kb(measurement.bytes)} of ${kb(BUDGETS[measurement.budget])}`;
}
