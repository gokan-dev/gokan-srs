// The comparison behind `bun run check:parity` (scripts/check-parity.ts): two outputs of the
// dictionary, each a map from a path under dist/ to a hash of its bytes, compared file for file
// and reported by page type. Issue #199 changes how pages are made, never what they contain, and
// every one of its steps is held to "identical" by this; after it, every dictionary change gets
// the same report, so a PR says exactly which pages it touches. An output is a build today; a
// running server (fetched URL by URL) becomes a second kind of output in #199's step 4, which is
// why the comparison takes maps rather than directories.

/** What a path under dist/ is, for the report. Reporting only: nothing routes on it. */
export type OutputKind = 'word' | 'kanji' | 'grammar point' | 'list page' | 'search index' | 'sitemap' | 'asset';

export const OUTPUT_KINDS: readonly OutputKind[] = ['word', 'kanji', 'grammar point', 'list page', 'search index', 'sitemap', 'asset'];

/** grammar/<name>/ directories that are browse pages, not a grammar point. */
const GRAMMAR_BROWSE = new Set(['family', 'families', 'chapters', 'conjugations']);

/** `relative` uses forward slashes, as dist/ paths and URLs do. */
export function outputKindOf(relative: string): OutputKind {
    if (relative === 'sitemap.xml') return 'sitemap';
    if (/^data\/search-[a-z]+\.json$/.test(relative)) return 'search index';
    if (!relative.endsWith('.html')) return 'asset';
    const [section, name, ...rest] = relative.split('/');
    const entity = rest.length === 1 && rest[0] === 'index.html' && name !== undefined;
    if (entity && section === 'vocab' && /^\d+$/.test(name)) return 'word';
    // kanji/orders/ holds the learning orders: no kanji is named with a Latin word.
    if (entity && section === 'kanji' && name !== 'orders') return 'kanji';
    if (entity && section === 'grammar' && !GRAMMAR_BROWSE.has(name)) return 'grammar point';
    return 'list page';
}

export interface ParityResult {
    added: string[];
    removed: string[];
    changed: string[];
    /** Files present on both sides, compared. */
    compared: number;
}

/** `base` against `head`, each path to a hash of its bytes; every list sorted. */
export function compareOutputs(base: ReadonlyMap<string, string>, head: ReadonlyMap<string, string>): ParityResult {
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    let compared = 0;
    for (const [path, hash] of head) {
        const before = base.get(path);
        if (before === undefined) added.push(path);
        else {
            compared++;
            if (before !== hash) changed.push(path);
        }
    }
    for (const path of base.keys()) if (!head.has(path)) removed.push(path);
    return { added: added.sort(), removed: removed.sort(), changed: changed.sort(), compared };
}

export const isIdentical = (result: ParityResult): boolean =>
    result.added.length === 0 && result.removed.length === 0 && result.changed.length === 0;

/** Counts per kind, in OUTPUT_KINDS order, kinds with nothing left out. */
export function countByKind(paths: readonly string[]): [OutputKind, number][] {
    const counts = new Map<OutputKind, number>();
    for (const path of paths) {
        const kind = outputKindOf(path);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return OUTPUT_KINDS.flatMap(kind => {
        const count = counts.get(kind);
        return count ? [[kind, count] as [OutputKind, number]] : [];
    });
}

export interface Difference {
    /** 1-based line of the first differing character. */
    line: number;
    before: string;
    after: string;
}

/** Characters of context shown on each side of the first difference. */
const CONTEXT = 60;

/** Line breaks and tabs written out, so a difference in them (CRLF against LF) shows in a report. */
const visible = (text: string): string => text.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

/**
 * Where two texts first differ, with a short window around it on each side: pages are long and
 * often one line, so a whole line would not be readable in a report. Undefined when equal.
 */
export function firstDifference(before: string, after: string): Difference | undefined {
    if (before === after) return undefined;
    let at = 0;
    while (at < before.length && at < after.length && before[at] === after[at]) at++;
    const start = Math.max(0, at - CONTEXT);
    const window = (text: string): string => {
        const slice = visible(text.slice(start, at + CONTEXT));
        return `${start > 0 ? '…' : ''}${slice}${at + CONTEXT < text.length ? '…' : ''}`;
    };
    return { line: before.slice(0, at).split('\n').length, before: window(before), after: window(after) };
}

export interface Example {
    path: string;
    difference: Difference | undefined;
}

/** The report, as Markdown: a job summary as is, and readable in a terminal. */
export function parityReport(result: ParityResult, against: string, examples: readonly Example[]): string {
    if (isIdentical(result)) return `**Pages identical** to ${against}: all ${result.compared} files, none added or removed.`;
    const counts = (paths: readonly string[]): string => countByKind(paths).map(([kind, n]) => `${n} ${kind}`).join(', ');
    const lines = [
        `**Pages differ** from ${against}: ${result.changed.length} changed, ${result.added.length} added, ${result.removed.length} removed (of ${result.compared} compared).`,
        '',
    ];
    if (result.changed.length > 0) lines.push(`- changed: ${counts(result.changed)}`);
    if (result.added.length > 0) lines.push(`- added: ${counts(result.added)}`);
    if (result.removed.length > 0) lines.push(`- removed: ${counts(result.removed)}`);
    for (const { path, difference } of examples) {
        lines.push('', `\`${path}\`${difference ? `, line ${difference.line}:` : ''}`);
        if (difference) lines.push('```diff', `- ${difference.before}`, `+ ${difference.after}`, '```');
    }
    return lines.join('\n');
}

/** A few changed files to show, one per kind first, so a report on 40,000 words still shows the one list page that changed. */
export function exampleCandidates(changed: readonly string[], count: number): string[] {
    const firstOfKind = new Map<OutputKind, string>();
    for (const path of changed) {
        const kind = outputKindOf(path);
        if (!firstOfKind.has(kind)) firstOfKind.set(kind, path);
    }
    const picked = [...firstOfKind.values()];
    for (const path of changed) {
        if (picked.length >= count) break;
        if (!picked.includes(path)) picked.push(path);
    }
    return picked.slice(0, count);
}
