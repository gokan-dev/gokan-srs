import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Ruby } from './Ruby';

const readings = (html: string) => [...html.matchAll(/<ruby[^>]*>([^<]*)<rt[^>]*>([^<]*)<\/rt><\/ruby>/g)].map(m => [m[1], m[2]]);

describe('Ruby', () => {
    it('puts each reading over its kanji only, never over the okurigana', () => {
        const html = renderToStaticMarkup(<Ruby text="登場し" reading="とうじょうし" />);
        expect(readings(html)).toEqual([['登場', 'とうじょう']]);
        expect(html.endsWith('</ruby>し')).toBe(true);
        expect(readings(renderToStaticMarkup(<Ruby text="食べる" reading="たべる" />))).toEqual([['食', 'た']]);
    });

    it('renders kana, or a word without a reading, as plain text', () => {
        expect(renderToStaticMarkup(<Ruby text="ここ" reading="ここ" />)).toBe('ここ');
        expect(renderToStaticMarkup(<Ruby text="登場" reading={null} />)).toBe('登場');
    });

    it('sets the reading in gothic at half the text, padded apart from its neighbours', () => {
        const html = renderToStaticMarkup(<Ruby text="私" reading="わたし" tone="text-secondary" />);
        expect(html).toContain('class="font-gothic text-[0.5em] px-[0.1em] select-none text-secondary"');
    });

    it('keeps a word with furigana on one line', () => {
        expect(renderToStaticMarkup(<Ruby text="登場人物" reading="とうじょうじんぶつ" />)).toContain('<ruby class="whitespace-nowrap">');
    });

    it('marks a fallback, the whole reading over the whole word, and only a fallback', () => {
        expect(renderToStaticMarkup(<Ruby text="食べ" reading="たべる" />)).toContain('<ruby class="whitespace-nowrap" data-ruby-fallback="true">');
        expect(renderToStaticMarkup(<Ruby text="食べる" reading="たべる" />)).not.toContain('data-ruby-fallback');
    });
});
