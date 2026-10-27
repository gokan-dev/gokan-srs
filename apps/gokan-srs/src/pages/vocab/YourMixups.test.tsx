import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { mixupRecord } from '../../test/fixtures';
import { readExploreQuery } from '../../utils/exploreSearch.utils';
import { YourMixups } from './YourMixups';

function gradingOf(record: ReturnType<typeof mixupRecord>): string {
    const html = renderToStaticMarkup(<MemoryRouter><YourMixups vocabId={record.asked} records={[record]} /></MemoryRouter>);
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

    it("marks a search's match in the card's sentence", () => {
        const record = mixupRecord({ cue: 'The lake glittered.' });
        const html = renderToStaticMarkup(<MemoryRouter><YourMixups vocabId={record.asked} records={[record]} query={readExploreQuery('glit')} /></MemoryRouter>);
        expect(html).toContain('<mark class="bg-accent/15 text-inherit rounded-sm">glit</mark>');
    });
});
