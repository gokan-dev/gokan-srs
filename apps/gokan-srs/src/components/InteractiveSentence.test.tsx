import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sentence } from '../test/fixtures';
import { InteractiveSentence } from './InteractiveSentence';

// 彼 (v-kare) は 仕事 (v-shigoto): two words with cards, the particle plain.
const example = sentence({
    original: '彼は仕事',
    matches: {
        'v-kare': [{ start: 0, length: 1, reading: 'かれ' }],
        'v-shigoto': [{ start: 2, length: 2, reading: 'しごと' }],
    },
});

const triggers = (html: string) => [...html.matchAll(/<span[^>]*data-lookup-trigger[^>]*>/g)].map(match => match[0]);

describe('InteractiveSentence', () => {
    it('makes every matched word a lookup trigger', () => {
        const html = renderToStaticMarkup(<InteractiveSentence sentence={example} onVocabClick={() => undefined} />);
        expect(triggers(html)).toHaveLength(2);
        expect(triggers(html).every(tag => tag.includes('aria-haspopup="dialog"'))).toBe(true);
    });

    it('gives the word under review no card, as its quiz card already shows it', () => {
        const html = renderToStaticMarkup(<InteractiveSentence sentence={example} targetVocabId="v-shigoto" onVocabClick={() => undefined} />);
        expect(triggers(html)).toHaveLength(1);
        expect(html).toContain('仕事');
    });

    it('keeps the words out of the Tab order on a quiz card, and in it on a reading page', () => {
        const quiz = renderToStaticMarkup(<InteractiveSentence sentence={example} onVocabClick={() => undefined} />);
        expect(triggers(quiz).some(tag => tag.includes('tabindex'))).toBe(false);
        const page = renderToStaticMarkup(<InteractiveSentence sentence={example} onVocabClick={() => undefined} keyboardLinks />);
        expect(triggers(page).every(tag => tag.includes('tabindex="0"') && tag.includes('role="button"'))).toBe(true);
    });
});
