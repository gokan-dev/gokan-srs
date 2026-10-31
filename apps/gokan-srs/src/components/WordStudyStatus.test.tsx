import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProgressWithMetadata } from '../services/sync/types';
import { userProgress } from '../test/fixtures';
import { WordStudyStatus } from './WordStudyStatus';

let progress: ProgressWithMetadata | null = null;
let session: { committed: string[] } | null = null;

vi.mock('../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress, settings: null, session, grammarSession: null }, actions: {} }),
}));

describe('WordStudyStatus', () => {
    it('offers nothing before setup, where Learn would have no progress to add the word to', () => {
        progress = null;
        expect(renderToStaticMarkup(<WordStudyStatus vocabId="1" />)).toBe('');
    });

    it('offers Learn for a word not in the queue', () => {
        progress = userProgress();
        const html = renderToStaticMarkup(<WordStudyStatus vocabId="1" />);
        expect(html).toContain('<button');
        expect(html).toContain('Learn');
    });

    it('shows a new word as New beside Learn this word on a lookup card', () => {
        progress = userProgress();
        session = null;
        const html = renderToStaticMarkup(<WordStudyStatus vocabId="1" variant="card" />);
        expect(html).toContain('New');
        expect(html).toContain('Learn this word');
    });

    it('offers no Learn on a lookup card mid-session, where the session decides what comes next', () => {
        progress = userProgress();
        session = { committed: [] };
        const html = renderToStaticMarkup(<WordStudyStatus vocabId="1" variant="card" />);
        expect(html).toContain('New');
        expect(html).not.toContain('<button');
        session = null;
    });
});
