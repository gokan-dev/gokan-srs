import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PACING_EPOCH } from '../../../models/user.model';
import { srsEntry, userProgress, userSettings, vocabProgress } from '../../../test/fixtures';
import { ReviewPacing } from './ReviewPacing';

const settings = userSettings({ intervalModifier: 1.5, intervalModifierHistory: [{ from: PACING_EPOCH, value: 1.5 }] });
const render = (progress: ReturnType<typeof userProgress>) =>
    renderToStaticMarkup(<ReviewPacing settings={settings} progress={progress} onUpdateSettings={() => undefined} />);

describe('ReviewPacing', () => {
    it('shows one line, and no figures or chart, when there is nothing to forecast', () => {
        const html = render(userProgress());
        expect(html).toContain('The forecast appears once you have reviews scheduled.');
        expect(html).not.toContain('data-pacing-forecast');
        expect(html).not.toContain('Due now');
    });

    it('shows the figures and the chart once reviews are scheduled', () => {
        const due = srsEntry({ memoryStrength: 30, interval: 5, dueDate: new Date(Date.now() + 2 * 86_400_000) });
        const html = render(userProgress({ learningQueue: [vocabProgress({ vocabId: 'v1', totalReviews: 3, reading: due, meaning: srsEntry({ ...due }) })] }));
        expect(html).toContain('data-pacing-forecast');
        expect(html).toContain('Due now');
        expect(html).not.toContain('The forecast appears');
    });

    it('says there is nothing in the window, not nothing scheduled, when every review is further out', () => {
        const far = srsEntry({ memoryStrength: 30, interval: 70, dueDate: new Date(Date.now() + 60 * 86_400_000) });
        const html = render(userProgress({ learningQueue: [vocabProgress({ vocabId: 'v1', totalReviews: 3, reading: far, meaning: srsEntry({ ...far }) })] }));
        expect(html).not.toContain('once you have reviews scheduled');
        expect(html).toContain('No reviews in the next 30 days at this setting.');
        expect(html).not.toContain('data-pacing-forecast');
    });
});
