// The comparison behind `bun run check:parity` (scripts/check-parity.ts): two outputs of the
// dictionary, each a map from a path under dist/ to a hash of its bytes (and one to its content
// hash, so a renamed stylesheet is told apart from a changed page), compared file for file and
// reported by page type. Issue #199 changes how pages are made, never what they contain, and
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
    /** Files whose bytes differ: what `--expect identical` holds. */
    changed: string[];
    /**
     * The changed files whose content hash (`pageContentHash` in @gokan/deploy: a page with its
     * hashed-asset references blanked) is the same on both sides. A one-rule style edit renames
     * the stylesheet every page links, so by bytes it changes every page; this names that apart
     * from a change to what a page says. A subset of `changed`, sorted.
     */
    referenceOnly: string[];
    /** Files present on both sides, compared. */
    compared: number;
}

/**
 * The URL path a built file is served at under `basePath`: a page (index.html) at its directory,
 * with the trailing slash, every segment percent-encoded as a browser requests it.
 */
export function servedPath(basePath: string, file: string): string {
    const segments = file.split('/');
    const page = segments.at(-1) === 'index.html';
    const kept = page ? segments.slice(0, -1) : segments;
    return `${basePath}/${kept.map(encodeURIComponent).join('/')}${page && kept.length > 0 ? '/' : ''}`;
}

/** One output: each path to a hash of its bytes and to its content hash. */
export interface Output {
    bytes: ReadonlyMap<string, string>;
    content: ReadonlyMap<string, string>;
}

/** `base` against `head`; every list sorted. */
export function compareOutputs(base: Output, head: Output): ParityResult {
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    const referenceOnly: string[] = [];
    let compared = 0;
    for (const [path, hash] of head.bytes) {
        const before = base.bytes.get(path);
        if (before === undefined) added.push(path);
        else {
            compared++;
            if (before === hash) continue;
            changed.push(path);
            const content = head.content.get(path);
            if (content !== undefined && content === base.content.get(path)) referenceOnly.push(path);
        }
    }
    for (const path of base.bytes.keys()) if (!head.bytes.has(path)) removed.push(path);
    return { added: added.sort(), removed: removed.sort(), changed: changed.sort(), referenceOnly: referenceOnly.sort(), compared };
}

/** The changed files whose content differs too, sorted. */
export function contentChanged(result: ParityResult): string[] {
    const referenceOnly = new Set(result.referenceOnly);
    return result.changed.filter(path => !referenceOnly.has(path));
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

/** Extensions read as text for an example; anything else is shown by size. */
const TEXT_EXTENSIONS = ['.html', '.json', '.xml', '.css', '.js', '.svg', '.txt', '.webmanifest'];

/** Whether an output file is text, so its first difference can be shown (a PNG or a font is not). */
export const isTextOutput = (path: string): boolean => TEXT_EXTENSIONS.some(extension => path.endsWith(extension));

export type ExampleChange =
    | { kind: 'text'; difference: Difference | undefined }
    | { kind: 'binary'; beforeBytes: number; afterBytes: number };

export interface Example {
    path: string;
    change: ExampleChange;
}

function exampleLines({ path, change }: Example): string[] {
    switch (change.kind) {
        case 'binary':
            return ['', `\`${path}\`, binary, ${change.beforeBytes} bytes to ${change.afterBytes} bytes.`];
        case 'text': {
            const { difference } = change;
            if (!difference) return ['', `\`${path}\``];
            return ['', `\`${path}\`, line ${difference.line}:`, '```diff', `- ${difference.before}`, `+ ${difference.after}`, '```'];
        }
    }
}

/** The report, as Markdown: a job summary as is, and readable in a terminal. */
export function parityReport(result: ParityResult, against: string, examples: readonly Example[]): string {
    if (isIdentical(result)) return `**Pages identical** to ${against}: all ${result.compared} files, none added or removed.`;
    const counts = (paths: readonly string[]): string => countByKind(paths).map(([kind, n]) => `${n} ${kind}`).join(', ');
    const lines = [
        `**Pages differ** from ${against}: ${result.changed.length} changed, ${result.added.length} added, ${result.removed.length} removed (of ${result.compared} compared).`,
        '',
    ];
    const content = contentChanged(result);
    if (content.length > 0) lines.push(`- content changed: ${content.length} (${counts(content)})`);
    if (result.referenceOnly.length > 0) {
        lines.push(`- only hashed-asset references changed: ${result.referenceOnly.length} (${counts(result.referenceOnly)})`);
    }
    if (result.added.length > 0) lines.push(`- added: ${counts(result.added)}`);
    if (result.removed.length > 0) lines.push(`- removed: ${counts(result.removed)}`);
    for (const example of examples) lines.push(...exampleLines(example));
    return lines.join('\n');
}

/**
 * A few changed files to show, one per kind first, so a report on 40,000 words still shows the
 * one list page that changed; a file whose content changed before one whose only asset
 * references did, which is the same `<link href>` on every page.
 */
export function exampleCandidates(result: ParityResult, count: number): string[] {
    const changed = [...contentChanged(result), ...result.referenceOnly];
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

export interface ParityOptions {
    base: string;
    build: boolean;
    expectIdentical: boolean;
    /** Compare the static build with the server's pages (an on-request build), not with a base. */
    againstServer: boolean;
    /**
     * Compare the static build with what a deployed site serves (staging, production), not with
     * a base: its origin, e.g. https://staging.gokan-srs.com. Build with that origin
     * (VITE_SITE_ORIGIN), or the canonicals differ on every page.
     */
    againstOrigin?: string;
}

export const PARITY_USAGE = 'usage: bun run check:parity [--base <ref> | --against-server | --against <origin>] [--no-build] [--expect identical]';

/** The command line, or an Error naming what is wrong (a value missing or another flag in its place). */
export function parseParityArgs(argv: readonly string[]): ParityOptions | Error {
    const known = new Set(['--base', '--no-build', '--expect', '--against-server', '--against']);
    const flags = new Set(['--no-build', '--against-server']);
    const values = new Map<string, string>();
    for (let at = 0; at < argv.length; at++) {
        const arg = argv[at];
        if (!known.has(arg)) return new Error(`unknown argument "${arg}". ${PARITY_USAGE}`);
        if (flags.has(arg)) continue;
        const value = argv[at + 1];
        if (value === undefined || value.startsWith('--')) return new Error(`${arg} needs a value. ${PARITY_USAGE}`);
        values.set(arg, value);
        at++;
    }
    const expectation = values.get('--expect');
    if (expectation !== undefined && expectation !== 'identical') return new Error(`--expect takes "identical", not "${expectation}". ${PARITY_USAGE}`);
    const againstServer = argv.includes('--against-server');
    const againstOrigin = values.get('--against');
    if ([againstServer, againstOrigin !== undefined, values.has('--base')].filter(Boolean).length > 1) {
        return new Error(`--base, --against-server and --against each name what the static build is compared with: one at most. ${PARITY_USAGE}`);
    }
    if (againstOrigin !== undefined && !/^https?:\/\/[^/]+$/.test(againstOrigin)) return new Error(`--against takes an origin, scheme and host only (https://staging.gokan-srs.com), not "${againstOrigin}". ${PARITY_USAGE}`);
    return {
        base: values.get('--base') ?? 'origin/main',
        build: !argv.includes('--no-build'),
        expectIdentical: expectation === 'identical',
        againstServer,
        ...(againstOrigin === undefined ? {} : { againstOrigin }),
    };
}
