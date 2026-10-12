// Splitting a long list into numbered pages: the JLPT word lists, so no list page is too heavy
// to load on a phone.

/** Words on one JLPT list page. */
export const JLPT_PAGE_SIZE = 500;

/** `items` in consecutive pages of `size`; one empty page for an empty list. */
export function paginate<T>(items: T[], size: number): T[][] {
    if (items.length === 0) return [[]];
    const pages: T[][] = [];
    for (let start = 0; start < items.length; start += size) pages.push(items.slice(start, start + size));
    return pages;
}
