import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PointHeaderActions } from './PointHeaderActions';

vi.mock('../../context/quiz/drillSelectors', () => ({ hasDrill: () => Promise.resolve(false) }));

describe('PointHeaderActions', () => {
    it('holds only the main action when the point has no drill, so no gap is left under it', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PointHeaderActions grammarId="n5-073"><span data-main>Learn</span></PointHeaderActions>
            </MemoryRouter>,
        );
        const column = /<div([^>]*)data-point-actions[^>]*>(.*)<\/div>$/.exec(html);
        expect(column).not.toBeNull();
        expect(column?.[1]).not.toMatch(/\bgap-/);
        expect(column?.[2]).toBe('<span data-main="true">Learn</span>');
    });
});
