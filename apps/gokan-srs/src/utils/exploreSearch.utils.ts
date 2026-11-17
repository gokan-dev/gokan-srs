import type { ExploreQuery } from '@gokan/dataset-schema';

/**
 * The search in a word page's Explore panels. Its matching is shared with the dictionary's section
 * search (`sectionSearch.ts` in @gokan/dataset-schema), re-exported here for the app's panels; the
 * count line is the app's.
 */
export { englishRanges, matchesExploreQuery, readExploreQuery, splitAtRanges, type ExploreQuery } from '@gokan/dataset-schema';

/** The line above a panel's results: "1,030 sentences", or "15 of 1,030 match "eat"". `noun` is singular, its plural regular. */
export function resultCountLine(matched: number, total: number, noun: string, query: ExploreQuery | null): string {
    const count = (n: number) => n.toLocaleString('en-US');
    if (!query) return `${count(total)} ${noun}${total === 1 ? '' : 's'}`;
    return `${count(matched)} of ${count(total)} match${matched === 1 ? 'es' : ''} "${query.text}"`;
}
