import { describe, expect, it } from 'vitest';
import { type CiRun, cleanLogLine, failedJobLogs, failedRuns, latestCiRuns, parseRuns, parseTimeoutMinutes, runLine, settled, verdict } from './ciRuns';

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

    it('keeps a push run and a pull_request run of one workflow apart, so a later pass cannot hide a failure', () => {
        const runs = latestCiRuns([
            run({ id: 1, event: 'push', conclusion: 'failure' }),
            run({ id: 2, event: 'pull_request' }),
        ], SHA);
        expect(runs.map(r => r.id)).toEqual([2, 1]);
        expect(verdict(runs)).toBe('failed');
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

describe('settled', () => {
    const runs = [run({}), run({ id: 2, workflow: 'CI: site' })];
    it('is not settled when the second look failed', () => {
        expect(settled(runs, undefined)).toBe(false);
    });
    it('is settled by the same runs with the same verdict', () => {
        expect(settled(runs, [run({}), run({ id: 2, workflow: 'CI: site' })])).toBe(true);
    });
    it('is not settled when a run appeared late or the verdict moved', () => {
        expect(settled(runs, [...runs, run({ id: 3, workflow: 'CI: layout', status: 'in_progress', conclusion: '' })])).toBe(false);
        expect(settled(runs, [run({}), run({ id: 2, workflow: 'CI: site', conclusion: 'failure' })])).toBe(false);
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
        expect(runLine(run({}))).toBe('CI: checks (push): success');
        expect(runLine(run({ event: 'pull_request', status: 'in_progress', conclusion: '' }))).toBe('CI: checks (pull_request): in_progress');
    });
});

describe('parseTimeoutMinutes', () => {
    it('reads a number of minutes above 0 and refuses anything else', () => {
        expect(parseTimeoutMinutes('60')).toBe(60);
        expect(parseTimeoutMinutes('1.5')).toBe(1.5);
        expect(parseTimeoutMinutes('1h')).toBeUndefined();
        expect(parseTimeoutMinutes('0')).toBeUndefined();
        expect(parseTimeoutMinutes('-5')).toBeUndefined();
        expect(parseTimeoutMinutes('')).toBeUndefined();
    });
});

describe('failedJobLogs', () => {
    it('splits the log by job, each cut to its own tail', () => {
        const log = [
            'lint\tRun lint\t2026-11-20T10:00:00.0Z a1',
            'lint\tRun lint\t2026-11-20T10:00:01.0Z a2',
            'lint\tRun lint\t2026-11-20T10:00:02.0Z a3',
            'test\tRun tests\t2026-11-20T10:00:03.0Z b1',
            'test\tRun tests\t2026-11-20T10:00:04.0Z b2',
            '',
        ].join('\n');
        expect(failedJobLogs(log, 2)).toEqual([
            { job: 'lint', lines: ['a2', 'a3'] },
            { job: 'test', lines: ['b1', 'b2'] },
        ]);
    });
});
