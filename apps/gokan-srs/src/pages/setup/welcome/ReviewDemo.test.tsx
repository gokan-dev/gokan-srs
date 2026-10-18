import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewSentence } from './ReviewDemo';
import { WELCOME_EXAMPLES } from './welcomeExamples';

const example = WELCOME_EXAMPLES.kklc;
/** The class list of the element that wraps the word's ruby. */
const rubyWrapper = (html: string) => /<span class="([^"]*)"><ruby/.exec(html)?.[1].replaceAll('&amp;', '&').split(' ') ?? [];

describe('ReviewSentence', () => {
    it('keeps the reading out of the accessibility tree until the answer is checked', () => {
        // Opacity alone hides it from the eye only; a screen reader would read the answer out.
        const unchecked = renderToStaticMarkup(<ReviewSentence example={example} checked={false} />);
        expect(unchecked).toContain(`<rt`);
        expect(rubyWrapper(unchecked)).toContain('[&_rt]:invisible');

        const checked = renderToStaticMarkup(<ReviewSentence example={example} checked />);
        expect(rubyWrapper(checked)).not.toContain('[&_rt]:invisible');
        expect(rubyWrapper(checked)).not.toContain('[&_rt]:opacity-0');
    });
});
