import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ChapterDrillLink } from './ChapterDrillLink';

vi.mock('../../context/quiz/drillSelectors', () => ({ hasDrill: () => Promise.resolve(false) }));

describe('ChapterDrillLink', () => {
    it('leaves nothing spaced between the header and the rows when the chapter has no drill', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <ChapterDrillLink chapterId="n5-c16" />
            </MemoryRouter>,
        );
        const wrapper = /<div([^>]*)data-chapter-drill[^>]*>(.*?)<\/div>/.exec(html);
        if (wrapper) {
            expect(wrapper[1]).not.toMatch(/\b[pm][trblxy]?-\d/);
            expect(wrapper[2]).toBe('');
        }
    });
});
