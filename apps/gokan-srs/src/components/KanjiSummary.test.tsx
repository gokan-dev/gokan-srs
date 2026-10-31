import type { Kanji } from '@gokan/dataset-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { kanji as kanjiFixture } from '../test/fixtures';
import { KanjiSummary } from './KanjiSummary';

function render(kanji: Kanji | 'loading' | null): string {
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

    it('labels its on and kun readings as field labels, the okurigana in parentheses', () => {
        const html = render(kanjiFixture());
        const labels = [...html.matchAll(/<dt class="([^"]*)">([^<]*)<\/dt>/g)];
        expect(labels.map(match => match[2])).toEqual(['On', 'Kun']);
        for (const match of labels) expect(match[1].split(' ')).toContain('type-label');
        expect(html).toContain('まな(ぶ)');
    });
});
