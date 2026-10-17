import { describe, it, expect } from 'vitest';
import { routeSeo } from './seo.utils';
import html from '../../index.html?raw';

describe('routeSeo', () => {
    it('indexes the homepage and About under their own URL', () => {
        expect(routeSeo('/')).toEqual({ kind: 'canonical', path: '/' });
        expect(routeSeo('/about')).toEqual({ kind: 'canonical', path: '/about' });
        expect(routeSeo('/about/')).toEqual({ kind: 'canonical', path: '/about' });
    });

    it('points each detail route at the dictionary page it duplicates', () => {
        expect(routeSeo('/vocab/1589350')).toEqual({ kind: 'canonical', path: '/dictionary/vocab/1589350/' });
        expect(routeSeo('/grammar/n5-001')).toEqual({ kind: 'canonical', path: '/dictionary/grammar/n5-001/' });
        expect(routeSeo('/grammar/family/conditional')).toEqual({ kind: 'canonical', path: '/dictionary/grammar/family/conditional/' });
    });

    it('spells a kanji URL the way the dictionary links it, encoded or not', () => {
        const expected = { kind: 'canonical', path: '/dictionary/kanji/%E5%AD%A6/' };
        expect(routeSeo('/kanji/%E5%AD%A6')).toEqual(expected);
        expect(routeSeo('/kanji/学')).toEqual(expected);
    });

    it('keeps personal and session routes out of the index', () => {
        for (const route of [
            '/quiz', '/grammar', '/grammar/', '/grammar/browse', '/grammar/chapters', '/grammar/family',
            '/stats', '/settings', '/kanji', '/vocab', '/listening', '/listening/123', '/profile',
        ]) {
            expect(routeSeo(route), route).toEqual({ kind: 'noindex' });
        }
    });

    it('never guesses a dictionary page for a path that is not one entry', () => {
        expect(routeSeo('/vocab/1/extra')).toEqual({ kind: 'noindex' });
        expect(routeSeo('/kanji/%E5%AD')).toEqual({ kind: 'noindex' });
    });
});

describe('index.html', () => {
    // A static canonical would claim every route is the homepage, and a second one beside the
    // route's own leaves Google to pick. The route sets all of these (RouteSeo).
    it('declares no canonical, page URL or robots directive of its own', () => {
        expect(html).not.toMatch(/rel="canonical"/);
        expect(html).not.toMatch(/property="og:url"/);
        expect(html).not.toMatch(/name="twitter:url"/);
        expect(html).not.toMatch(/name="robots"/);
    });
});
