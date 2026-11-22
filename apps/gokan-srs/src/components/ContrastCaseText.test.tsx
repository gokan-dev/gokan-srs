import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContrastCaseText } from './ContrastCaseText';

const contrast = { situation: 'Right after an action:', guidance: 'use てから, not あとで, for the next step.' };

describe('ContrastCaseText', () => {
    it('sets every Japanese run of the situation and the guidance in a Japanese face', () => {
        const html = renderToStaticMarkup(<ContrastCaseText contrast={{ ...contrast, situation: 'After 食べる:' }} />);
        for (const run of ['食べる', 'てから', 'あとで']) {
            expect(html).toContain(`<span class="font-gothic" lang="ja">${run}</span>`);
        }
    });

    it('shows a label only when given one', () => {
        expect(renderToStaticMarkup(<ContrastCaseText contrast={contrast} />)).not.toContain('type-label');
        expect(renderToStaticMarkup(<ContrastCaseText contrast={contrast} label="Which one, and when" />)).toContain('Which one, and when');
    });
});
