import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { audioIndex } from '../../test/fixtures';
import { VoiceCredit } from './VoiceCredit';

describe('VoiceCredit', () => {
    it('links the credit, verbatim, to the voice\'s terms, set as Japanese on one line', () => {
        const audio = audioIndex();
        const html = renderToStaticMarkup(<VoiceCredit audio={audio} />);
        const link = /<a ([^>]*)>([^<]*)<\/a>/.exec(html);
        expect(link?.[2]).toBe(audio.credit);
        const attributes = link?.[1] ?? '';
        expect(attributes).toContain(`href="${audio.termsUrl}"`);
        expect(attributes).toContain('lang="ja"');
        expect(attributes).toMatch(/class="[^"]*\bfont-gothic\b[^"]*"/);
        expect(attributes).toMatch(/class="[^"]*\bwhitespace-nowrap\b[^"]*"/);
    });
});
