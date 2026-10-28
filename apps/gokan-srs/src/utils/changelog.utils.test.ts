import { describe, it, expect } from 'vitest';
import { availableUpdate, changelogDate, changelogProblems, compareVersions, parseChangelog, parseLiveVersion } from './changelog.utils';
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
});
