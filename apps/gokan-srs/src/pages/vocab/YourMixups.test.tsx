import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ProgressWithMetadata } from '../../services/sync/types';
import { mixupRecord, userProgress } from '../../test/fixtures';
import { YourMixups } from './YourMixups';

let progress: ProgressWithMetadata | null = null;

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress, settings: null }, actions: {} }),
}));

function gradingOf(record: ReturnType<typeof mixupRecord>): string {
    progress = { ...userProgress(), mixups: [record] };
    const html = renderToStaticMarkup(<MemoryRouter><YourMixups vocabId={record.asked} /></MemoryRouter>);
    const match = /<span class="([^"]*)">(accepted[^<]*|no penalty|marked wrong)<\/span>/.exec(html);
    if (!match) throw new Error(`no grading in ${html}`);
    return match[1];
}

describe('YourMixups', () => {
    // An answer history: results use the feedback pair, with the words as the second cue.
    it('colours an accepted answer correct', () => {
        expect(gradingOf(mixupRecord({ outcome: 'accepted', meaning: 'shine' }))).toContain('text-feedback-correct');
    });

    it('colours a wrong answer incorrect', () => {
        expect(gradingOf(mixupRecord({ outcome: 'wrong' }))).toContain('text-feedback-incorrect');
    });

    it('leaves no penalty neutral', () => {
        expect(gradingOf(mixupRecord({ outcome: 'neutral' }))).not.toMatch(/text-feedback-/);
    });
});
