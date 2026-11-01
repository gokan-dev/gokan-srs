import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayButton, SentenceWithPlay } from './PlayButton';

describe('PlayButton', () => {
    it('renders nothing, never a disabled button, for an item with no clip', () => {
        expect(renderToStaticMarkup(<PlayButton audio={undefined} label="Play sentence" />)).toBe('');
    });

    it('keeps a sentence with no clip, with no button beside it', () => {
        const html = renderToStaticMarkup(<SentenceWithPlay audio={undefined}><span>猫です。</span></SentenceWithPlay>);
        expect(html).toContain('猫です。');
        expect(html).not.toContain('<button');
    });
});
