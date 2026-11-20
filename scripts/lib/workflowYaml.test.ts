import { describe, expect, it } from 'vitest';
import { missedEvents, strandedListenerKeys, workflowEvents } from './workflowYaml';

const events = (text: string) => [...workflowEvents(text)];

describe('workflowEvents', () => {
    it('reads one event written inline', () => {
        expect(events('name: "A"\non: push\njobs:\n')).toEqual(['push']);
    });

    it('reads an inline list', () => {
        expect(events('name: "A"\non: [push, workflow_dispatch]\njobs:\n')).toEqual(['push', 'workflow_dispatch']);
    });

    it('reads a block, past comments, blank lines and nested keys', () => {
        const text = [
            'name: "A"',
            '',
            'on:',
            '  push:',
            '    # tags are left out',
            "    branches: ['**']",
            '    paths:',
            "      - 'apps/**'",
            '',
            '  # no pull_request: see ci.yml',
            '  workflow_dispatch: # by hand',
            '',
            'concurrency:',
            '  group: x',
        ].join('\n');
        expect(events(text)).toEqual(['push', 'workflow_dispatch']);
    });

    it('reads a block ending the file', () => {
        expect(events('on:\n  workflow_run:\n    workflows: ["A"]')).toEqual(['workflow_run']);
    });

    it('reads nothing when there is no `on:`', () => {
        expect(events('name: "A"\nruns:\n  using: composite\n')).toEqual([]);
    });
});

describe('missedEvents', () => {
    it('passes a workflow that runs on one of several accepted events', () => {
        expect(missedEvents(new Set(['push', 'pull_request']), new Set(['push', 'workflow_dispatch']))).toBeNull();
    });

    it('names the accepted events a workflow runs on none of', () => {
        expect(missedEvents(new Set(['push', 'pull_request']), new Set(['workflow_dispatch'])))
            .toBe('runs on none of push, pull_request (its `on:` has workflow_dispatch)');
    });

    it('passes when the listener accepts any event', () => {
        expect(missedEvents(new Set(), new Set(['schedule']))).toBeNull();
    });
});

describe('strandedListenerKeys', () => {
    it('passes keys that name a workflow file', () => {
        expect(strandedListenerKeys(['claude-fix-ci.yml'], ['ci.yml', 'claude-fix-ci.yml'])).toEqual([]);
    });

    it('names a key whose listener file is gone', () => {
        expect(strandedListenerKeys(['agent-fix-ci.yml'], ['ci.yml', 'claude-fix-ci.yml'])).toEqual(['agent-fix-ci.yml']);
    });
});
