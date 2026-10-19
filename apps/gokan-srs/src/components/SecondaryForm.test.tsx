import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { vocabulary } from '../test/fixtures';
import { SecondaryForm } from './SecondaryForm';

describe('SecondaryForm', () => {
    it('shows a word learned in kana with its kanji spelling, in mincho', () => {
        const koko = vocabulary({ usuallyKana: true, writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] }, reading: { primary: 'ここ', alternatives: [] } });
        const html = renderToStaticMarkup(<SecondaryForm vocab={koko} />);
        expect(html).toMatch(/^<span lang="ja" class="[^"]*\bfont-mincho\b[^"]*">此処<\/span>$/);
    });

    it('shows any other word with its reading, in gothic', () => {
        const nihon = vocabulary({ writtenForm: { kanji: '日本', alternatives: [], containedKanji: ['日', '本'] }, reading: { primary: 'にほん', alternatives: [] } });
        const html = renderToStaticMarkup(<SecondaryForm vocab={nihon} />);
        expect(html).toMatch(/^<span lang="ja" class="[^"]*\bfont-gothic\b[^"]*">にほん<\/span>$/);
    });

    it('never breaks the form when it is not cut', () => {
        const html = renderToStaticMarkup(<SecondaryForm vocab={vocabulary()} truncate={false} />);
        expect(html).toContain('whitespace-nowrap');
        expect(html).not.toContain('truncate');
    });
});
