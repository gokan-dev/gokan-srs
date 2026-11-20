import { describe, expect, it } from 'vitest';
import { type CiRun, cleanLogLine, failedRuns, latestCiRuns, parseRuns, runLine, verdict } from './ciRuns';

const SHA = 'abc123';

function run(overrides: Partial<CiRun>): CiRun {
    return {
        id: 1,
        workflow: 'CI: checks',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        headSha: SHA,
        url: 'https://github.com/gokan-dev/gokan-srs/actions/runs/1',
        createdAt: '2026-11-20T10:00:00Z',
        ...overrides,
    };
}

describe('parseRuns', () => {
    it('reads gh run list rows and drops the ones without an id or workflow', () => {
        const runs = parseRuns([
            { databaseId: 7, workflowName: 'CI: site', event: 'push', status: 'queued', conclusion: '', headSha: SHA, url: 'u', createdAt: 't' },
            { workflowName: 'CI: checks' },
            { databaseId: 8 },
            'noise',
        ]);
        expect(runs).toEqual([run({ id: 7, workflow: 'CI: site', status: 'queued', conclusion: '', url: 'u', createdAt: 't' })]);
    });

    it('refuses anything but a list', () => {
        expect(() => parseRuns({ runs: [] })).toThrow();
    });
});

describe('latestCiRuns', () => {
    it('keeps the CI workflows of the commit, the latest run of each', () => {
        const runs = [
            run({ id: 1, conclusion: 'failure' }),
            run({ id: 3 }),
            run({ id: 2, workflow: 'CI: site' }),
            run({ id: 4, workflow: 'Agent: review PR' }),
            run({ id: 5, workflow: 'Deploy: staging' }),
            run({ id: 6, headSha: 'other' }),
        ];
        expect(latestCiRuns(runs, SHA).map(r => r.id)).toEqual([3, 2]);
    });
});

describe('verdict', () => {
    it('is pending until a run exists and every run has completed', () => {
        expect(verdict([])).toBe('pending');
        expect(verdict([run({}), run({ id: 2, workflow: 'CI: site', status: 'in_progress', conclusion: '' })])).toBe('pending');
    });

    it('passes when every run succeeded or was skipped', () => {
        expect(verdict([run({}), run({ id: 2, workflow: 'CI: site', conclusion: 'skipped' })])).toBe('passed');
    });

    it('fails on any other conclusion, a cancelled run included', () => {
        expect(verdict([run({}), run({ id: 2, workflow: 'CI: site', conclusion: 'failure' })])).toBe('failed');
        expect(verdict([run({ conclusion: 'cancelled' })])).toBe('failed');
        expect(failedRuns([run({}), run({ id: 2, conclusion: 'timed_out' })]).map(r => r.id)).toEqual([2]);
    });
});

describe('cleanLogLine', () => {
    it('keeps what the job printed, without the prefix gh adds or colour codes', () => {
        expect(cleanLogLine('bun run check\tUNKNOWN STEP\t2026-11-19T13:49:48.7461796Z \x1b[31m1 failed\x1b[39m | 48 passed'))
            .toBe('1 failed | 48 passed');
        expect(cleanLogLine('plain line')).toBe('plain line');
    });
});

describe('runLine', () => {
    it('shows the conclusion of a finished run and the status of an unfinished one', () => {
        expect(runLine(run({}))).toBe('CI: checks: success');
        expect(runLine(run({ status: 'in_progress', conclusion: '' }))).toBe('CI: checks: in_progress');
    });
});
