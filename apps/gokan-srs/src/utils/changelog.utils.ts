import type { ChangelogChange, ChangelogEntry, LiveVersion } from '../models/release.model';
import { isRecord } from '../services/http';

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The three numbers of `1.43.0`, or null for anything else. */
function versionParts(version: string): [number, number, number] | null {
    const match = VERSION.exec(version);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
    const pa = versionParts(a);
    const pb = versionParts(b);
    if (!pa || !pb) throw new Error(`Not a version: ${pa ? b : a}`);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

/** A changelog day as a local date, so it is not shown as the day before west of UTC. */
export function changelogDate(day: string): Date {
    const match = DAY.exec(day);
    if (!match) throw new Error(`Not a day: ${day}`);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * What is wrong with a changelog, empty when nothing is: the build refuses one that is not
 * strictly newest first (the newest entry is the app's version), and every entry needs a real
 * version, day and sentence.
 */
export function changelogProblems(entries: readonly ChangelogEntry[]): string[] {
    const problems: string[] = [];
    if (entries.length === 0) problems.push('the changelog is empty: its newest entry is the app version');
    entries.forEach((entry, i) => {
        const name = `entry ${i} (${entry.version})`;
        if (!versionParts(entry.version)) problems.push(`${name}: version is not X.Y.Z`);
        const day = DAY.exec(entry.date);
        const date = day ? changelogDate(entry.date) : null;
        if (!date || date.getMonth() !== Number(day?.[2]) - 1) problems.push(`${name}: date is not a YYYY-MM-DD day`);
        if (entry.summary.trim() === '') problems.push(`${name}: summary is empty`);
        if (entry.issue !== undefined && !(Number.isInteger(entry.issue) && entry.issue > 0)) problems.push(`${name}: issue is not a number`);
        if (entry.changes !== undefined) {
            if (entry.changes.length === 0) problems.push(`${name}: changes is present but empty`);
            entry.changes.forEach((change, j) => {
                if (change.summary.trim() === '') problems.push(`${name}: change ${j} summary is empty`);
                if (change.issue !== undefined && !(Number.isInteger(change.issue) && change.issue > 0)) problems.push(`${name}: change ${j} issue is not a number`);
            });
        }
        const previous = entries[i - 1];
        if (!previous || !versionParts(previous.version) || !versionParts(entry.version)) return;
        if (compareVersions(previous.version, entry.version) <= 0) problems.push(`${name}: not older than ${previous.version} above it`);
        if (previous.date < entry.date) problems.push(`${name}: dated after ${previous.version} above it`);
    });
    return problems;
}

/** One of a release's changes from `/changelog.json`, or null when it is not one. */
function parseChange(value: unknown): ChangelogChange | null {
    if (!isRecord(value)) return null;
    const { summary, issue } = value;
    if (typeof summary !== 'string') return null;
    if (issue !== undefined && typeof issue !== 'number') return null;
    return issue === undefined ? { summary } : { summary, issue };
}

/** One entry from `/changelog.json`, or null when it is not one. */
function parseEntry(value: unknown): ChangelogEntry | null {
    if (!isRecord(value)) return null;
    const { version, date, summary, issue, changes } = value;
    if (typeof version !== 'string' || typeof date !== 'string' || typeof summary !== 'string') return null;
    if (issue !== undefined && typeof issue !== 'number') return null;
    let parsedChanges: ChangelogChange[] | undefined;
    if (changes !== undefined) {
        if (!Array.isArray(changes)) return null;
        parsedChanges = [];
        for (const raw of changes) {
            const change = parseChange(raw);
            if (!change) return null;
            parsedChanges.push(change);
        }
    }
    const base: ChangelogEntry = issue === undefined ? { version, date, summary } : { version, date, summary, issue };
    return parsedChanges === undefined ? base : { ...base, changes: parsedChanges };
}

/**
 * `/changelog.json`, narrowed from the response body. The build wrote it, so a body that is not
 * a valid changelog is a broken deploy and fails loudly.
 */
export function parseChangelog(body: unknown): ChangelogEntry[] {
    if (!Array.isArray(body)) throw new Error('changelog.json is not a list');
    const entries = body.map((value: unknown, i) => {
        const entry = parseEntry(value);
        if (!entry) throw new Error(`changelog.json entry ${i} is not a changelog entry`);
        return entry;
    });
    const problems = changelogProblems(entries);
    if (problems.length) throw new Error(`changelog.json: ${problems.join('; ')}`);
    return entries;
}

/** `/version.json`, narrowed from the response body. */
export function parseLiveVersion(body: unknown): LiveVersion {
    if (!isRecord(body) || typeof body.version !== 'string' || typeof body.dataset !== 'string' || !versionParts(body.version)) {
        throw new Error('version.json is not a version');
    }
    return { version: body.version, dataset: body.dataset };
}

/**
 * The live version an open tab should offer to reload into, or null when it runs that one or
 * the learner dismissed that one. Any difference counts, a rollback included: the tab's chunks
 * are gone either way once the deploy prunes them.
 */
export function availableUpdate(running: string, live: LiveVersion | null, dismissed: string | null = null): string | null {
    if (!live || live.version === running || live.version === dismissed) return null;
    return live.version;
}

// Release assembly (release/assemble-fragments.ts). A sprint's member PRs drop one
// `changelog.d/<issue>-<slug>.md` fragment each; at `release` -> `main` these fold into one
// multi-feature entry, so the whole sprint ships as a single version. Pure here, tested; the
// script does the file I/O around them.

/** The issue number a `changelog.d/<issue>-<slug>.md` fragment names, or null when it is not one. */
export function fragmentIssue(filename: string): number | null {
    const base = filename.replace(/^.*[/\\]/, '');
    const match = /^(\d+)-.+\.md$/.exec(base);
    return match ? Number(match[1]) : null;
}

/** A single-quoted TS string literal (release/changelog.ts's style) for arbitrary text. */
function quote(text: string): string {
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** One entry as the object literal release/changelog.ts holds, indented for its array. */
export function serializeEntry(entry: ChangelogEntry): string {
    const lines = [
        '    {',
        `        version: ${quote(entry.version)},`,
        `        date: ${quote(entry.date)},`,
        `        summary: ${quote(entry.summary)},`,
    ];
    if (entry.issue !== undefined) lines.push(`        issue: ${entry.issue},`);
    if (entry.changes !== undefined) {
        lines.push('        changes: [');
        for (const change of entry.changes) {
            const issue = change.issue !== undefined ? `, issue: ${change.issue}` : '';
            lines.push(`            { summary: ${quote(change.summary)}${issue} },`);
        }
        lines.push('        ],');
    }
    lines.push('    },');
    return lines.join('\n');
}

const ARRAY_OPEN = 'export const CHANGELOG: readonly ChangelogEntry[] = [';

/**
 * release/changelog.ts with `entry` inserted as the newest (top) entry. Throws when the array
 * marker is gone, so a changed file shape fails loudly rather than silently appending nothing.
 */
export function insertChangelogEntry(source: string, entry: ChangelogEntry): string {
    const at = source.indexOf(ARRAY_OPEN);
    if (at === -1) throw new Error('changelog.ts: the CHANGELOG array opener was not found');
    const after = at + ARRAY_OPEN.length;
    return `${source.slice(0, after)}\n${serializeEntry(entry)}${source.slice(after)}`;
}
