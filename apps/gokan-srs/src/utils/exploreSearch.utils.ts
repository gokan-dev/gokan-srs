import { toHiragana } from '@gokan/dataset-schema';

/**
 * The search in a word page's Explore panels: one field, matched against a row's English and
 * Japanese text. English matches from the start of a word ("eat" finds "eaten", not "great");
 * Japanese matches anywhere, hiragana and katakana alike.
 */

export type ExploreQuery =
    | { kind: 'english'; text: string; pattern: RegExp }
    | { kind: 'japanese'; text: string; kana: string };

const JAPANESE = /[぀-ヿ㐀-鿿豈-﫿々ー]/;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The query as typed, read once; null when empty, so nothing is filtered. */
export function readExploreQuery(raw: string): ExploreQuery | null {
    const text = raw.trim();
    if (text === '') return null;
    if (JAPANESE.test(text)) return { kind: 'japanese', text, kana: toHiragana(text) };
    // A word starts after anything that is not a letter or a digit ("to-do", "(eat)").
    return { kind: 'english', text, pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(text)}`, 'giu') };
}

/** Whether a row matches: an English query against its English lines, a Japanese one against its Japanese. */
export function matchesExploreQuery(query: ExploreQuery, text: { english: readonly string[]; japanese: readonly string[] }): boolean {
    switch (query.kind) {
        case 'english': return text.english.some(line => englishRanges(query, line).length > 0);
        case 'japanese': return text.japanese.some(line => toHiragana(line).includes(query.kana));
    }
}

/** Where an English query matches in a line, as [start, end) ranges for `<mark>`; none for a Japanese query. */
export function englishRanges(query: ExploreQuery | null, line: string): [number, number][] {
    if (query?.kind !== 'english') return [];
    return [...line.matchAll(query.pattern)].map(m => [m.index, m.index + m[0].length]);
}

/** A line cut at its matches, for rendering: each part with whether it is a match. */
export function splitAtRanges(line: string, ranges: readonly [number, number][]): { text: string; match: boolean }[] {
    const parts: { text: string; match: boolean }[] = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
        if (start > cursor) parts.push({ text: line.slice(cursor, start), match: false });
        parts.push({ text: line.slice(start, end), match: true });
        cursor = end;
    }
    if (cursor < line.length) parts.push({ text: line.slice(cursor), match: false });
    return parts;
}

/** The line above a panel's results: "1,030 sentences", or "15 of 1,030 match "eat"". `noun` is singular, its plural regular. */
export function resultCountLine(matched: number, total: number, noun: string, query: ExploreQuery | null): string {
    const count = (n: number) => n.toLocaleString('en-US');
    if (!query) return `${count(total)} ${noun}${total === 1 ? '' : 's'}`;
    return `${count(matched)} of ${count(total)} match${matched === 1 ? 'es' : ''} "${query.text}"`;
}
