import { describe, it, expect } from 'vitest';
import { availableUpdate, changelogDate, changelogProblems, compareVersions, fragmentIssue, insertChangelogEntry, parseChangelog, parseLiveVersion, serializeEntry } from './changelog.utils';
import type { ChangelogEntry } from '../models/release.model';
import { CHANGELOG } from '../../release/changelog';

const entry = (overrides: Partial<ChangelogEntry> = {}): ChangelogEntry =>
    ({ version: '1.2.0', date: '2026-10-02', summary: 'A change.', ...overrides });

describe('compareVersions', () => {
    it('orders by major, then minor, then patch, numerically', () => {
        expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
        expect(compareVersions('1.9.3', '2.0.0')).toBeLessThan(0);
        expect(compareVersions('1.9.1', '1.9.0')).toBeGreaterThan(0);
        expect(compareVersions('1.9.0', '1.9.0')).toBe(0);
    });

    it('refuses what is not a version', () => {
        expect(() => compareVersions('v1.0.0', '1.0.0')).toThrow('v1.0.0');
    });
});

describe('changelogDate', () => {
    it('is the local day, not the UTC midnight that shows as the day before west of UTC', () => {
        const date = changelogDate('2026-10-28');
        expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 28]);
    });
});

describe('changelogProblems', () => {
    it('accepts a list newest first', () => {
        expect(changelogProblems([entry({ version: '1.3.0', date: '2026-10-03' }), entry()])).toEqual([]);
    });

    it('refuses an empty list: the newest entry is the app version', () => {
        expect(changelogProblems([])).toHaveLength(1);
    });

    it('refuses an entry that is not older than the one above it', () => {
        expect(changelogProblems([entry(), entry({ version: '1.3.0' })])).toEqual([expect.stringContaining('not older than 1.2.0')]);
        expect(changelogProblems([entry(), entry()])).toEqual([expect.stringContaining('not older than 1.2.0')]);
    });

    it('refuses an older version dated after the newer one', () => {
        expect(changelogProblems([entry({ version: '1.3.0' }), entry({ date: '2026-10-05' })])).toEqual([expect.stringContaining('dated after')]);
    });

    it('refuses a malformed version, day, summary or issue', () => {
        expect(changelogProblems([entry({ version: 'v1.2' })])).toEqual([expect.stringContaining('X.Y.Z')]);
        expect(changelogProblems([entry({ date: '2026-02-30' })])).toEqual([expect.stringContaining('YYYY-MM-DD')]);
        expect(changelogProblems([entry({ date: '28 Oct 2026' })])).toEqual([expect.stringContaining('YYYY-MM-DD')]);
        expect(changelogProblems([entry({ summary: ' ' })])).toEqual([expect.stringContaining('summary')]);
        expect(changelogProblems([entry({ issue: 1.5 })])).toEqual([expect.stringContaining('issue')]);
    });

    it('passes for the committed changelog, which the build also refuses to ship otherwise', () => {
        expect(changelogProblems(CHANGELOG)).toEqual([]);
    });
});

describe('parseChangelog', () => {
    it('narrows the served list, keeping an entry without an issue', () => {
        const body: unknown = JSON.parse(JSON.stringify([entry({ version: '1.3.0', issue: 7 }), entry()]));
        expect(parseChangelog(body)).toEqual([entry({ version: '1.3.0', issue: 7 }), entry()]);
    });

    it('fails loudly on a body that is not a changelog', () => {
        expect(() => parseChangelog({})).toThrow('not a list');
        expect(() => parseChangelog([{ version: '1.0.0' }])).toThrow('entry 0');
        expect(() => parseChangelog([entry({ issue: undefined }), { ...entry(), issue: '3' }])).toThrow('entry 1');
        expect(() => parseChangelog([entry(), entry({ version: '1.3.0' })])).toThrow('not older');
    });
});

describe('parseLiveVersion', () => {
    it('narrows version.json', () => {
        expect(parseLiveVersion({ version: '1.43.0', dataset: 'abc123' })).toEqual({ version: '1.43.0', dataset: 'abc123' });
    });

    it('fails on anything else', () => {
        expect(() => parseLiveVersion(null)).toThrow();
        expect(() => parseLiveVersion({ version: 'deploying', dataset: 'abc' })).toThrow();
        expect(() => parseLiveVersion({ version: '1.43.0' })).toThrow();
    });
});

describe('availableUpdate', () => {
    it('is the live version when it differs from the running one, a rollback included', () => {
        expect(availableUpdate('1.42.0', { version: '1.43.0', dataset: 'a' })).toBe('1.43.0');
        expect(availableUpdate('1.43.0', { version: '1.42.0', dataset: 'a' })).toBe('1.42.0');
    });

    it('is null for the running version, or before the live one is known', () => {
        expect(availableUpdate('1.43.0', { version: '1.43.0', dataset: 'a' })).toBeNull();
        expect(availableUpdate('1.43.0', null)).toBeNull();
    });

    it('is null once that version is dismissed, and offers the next one again', () => {
        expect(availableUpdate('1.42.0', { version: '1.43.0', dataset: 'a' }, '1.43.0')).toBeNull();
        expect(availableUpdate('1.42.0', { version: '1.44.0', dataset: 'a' }, '1.43.0')).toBe('1.44.0');
    });
});

describe('a release entry that bundled several features (changes)', () => {
    const release = entry({ version: '1.46.0', issue: undefined, changes: [
        { summary: 'Tabs on the word page.', issue: 172 },
        { summary: 'Pitch accent on the reading.', issue: 176 },
    ] });

    it('passes validation when each change has a summary and a valid issue', () => {
        expect(changelogProblems([release])).toEqual([]);
    });

    it('is flagged when changes is present but empty, or a change is malformed', () => {
        expect(changelogProblems([entry({ changes: [] })]).join()).toContain('changes is present but empty');
        expect(changelogProblems([entry({ changes: [{ summary: '  ' }] })]).join()).toContain('change 0 summary is empty');
        expect(changelogProblems([entry({ changes: [{ summary: 'x', issue: 0 }] })]).join()).toContain('change 0 issue is not a number');
    });

    it('round-trips through the /changelog.json parser', () => {
        const parsed = parseChangelog(JSON.parse(JSON.stringify([release])));
        expect(parsed[0].changes).toEqual(release.changes);
    });

    it('rejects a changes list with a non-object member', () => {
        expect(() => parseChangelog([{ version: '1.0.0', date: '2026-01-01', summary: 'x', changes: ['nope'] }])).toThrow();
    });
});

describe('fragmentIssue', () => {
    it('reads the issue number off a changelog.d fragment name', () => {
        expect(fragmentIssue('172-word-page-tabs.md')).toBe(172);
        expect(fragmentIssue('release/changelog.d/176-pitch-accent.md')).toBe(176);
    });

    it('is null for anything that is not a <issue>-<slug>.md fragment', () => {
        expect(fragmentIssue('.gitkeep')).toBeNull();
        expect(fragmentIssue('no-number.md')).toBeNull();
        expect(fragmentIssue('172.md')).toBeNull();
    });
});

describe('serializeEntry and insertChangelogEntry', () => {
    it('serialises an entry, escaping apostrophes, with its changes', () => {
        const text = serializeEntry(entry({ version: '1.46.0', summary: "A word's page.", issue: undefined, changes: [{ summary: 'Tabs.', issue: 172 }] }));
        expect(text).toContain("summary: 'A word\\'s page.',");
        expect(text).toContain('changes: [');
        expect(text).toContain("{ summary: 'Tabs.', issue: 172 },");
    });

    it('inserts the entry right after the array opener', () => {
        const source = 'export const CHANGELOG: readonly ChangelogEntry[] = [\n    { version: \'1.0.0\', date: \'2026-01-01\', summary: \'Old.\' },\n];\n';
        const out = insertChangelogEntry(source, entry({ version: '1.1.0' }));
        expect(out.indexOf("version: '1.1.0'")).toBeLessThan(out.indexOf("version: '1.0.0'"));
        expect(out).toContain('readonly ChangelogEntry[] = [\n    {\n        version: \'1.1.0\',');
    });

    it('throws when the array opener is gone', () => {
        expect(() => insertChangelogEntry('const X = [];', entry())).toThrow('CHANGELOG array opener');
    });
});
