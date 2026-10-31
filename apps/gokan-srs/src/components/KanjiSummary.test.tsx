import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { KanjiSummary } from './KanjiSummary';

function render(kanji: 'loading' | null): string {
    return renderToStaticMarkup(<MemoryRouter><KanjiSummary glyph="学" kanji={kanji} known={false} /></MemoryRouter>);
}

describe('KanjiSummary', () => {
    it('holds a line for the meanings and readings while the kanji loads', () => {
        expect(render('loading')).toContain('data-skeleton');
    });

    it('shows no placeholder for a kanji the dataset has no file for', () => {
        const html = render(null);
        expect(html).not.toContain('data-skeleton');
        expect(html).toContain('Not known');
    });
});
