import { describe, it, expect } from 'vitest';
import { isAboutPath, routeSeo } from './seo.utils';

const home = routeSeo('/');
const PUBLIC_HOME_TITLE = home.kind === 'canonical' ? home.page?.title : undefined;
import html from '../../index.html?raw';
import appSource from '../App.tsx?raw';

/** Every route path App declares, read from its source so a new route cannot be missed here. */
const APP_ROUTES = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]);

describe('routeSeo', () => {
    it('indexes the homepage and About under their own URL', () => {
        expect(routeSeo('/')).toMatchObject({ kind: 'canonical', path: '/' });
        expect(routeSeo('/about')).toMatchObject({ kind: 'canonical', path: '/about' });
        expect(routeSeo('/about/')).toMatchObject({ kind: 'canonical', path: '/about' });
    });

    it('gives the homepage and About their own title and description', () => {
        expect(routeSeo('/')).toMatchObject({
            page: {
                title: 'Gokan: Japanese vocabulary for the kanji you know (free SRS)',
                description: 'Free spaced repetition for Japanese vocabulary that follows your kanji book: KKLC, RTK, Kanji in Context and more. Learn the words you can now read. No account.',
            },
        });
        expect(routeSeo('/about/')).toMatchObject({
            page: {
                title: 'About Gokan: why I built it',
                description: 'Why I built Gokan, what it does, and where its data comes from.',
            },
        });
    });

    it('never repeats a title or a description between public routes', () => {
        const pages = ['/', '/about'].map(path => {
            const seo = routeSeo(path);
            return seo.kind === 'canonical' ? seo.page : undefined;
        });
        expect(new Set(pages.map(page => page?.title)).size).toBe(2);
        expect(new Set(pages.map(page => page?.description)).size).toBe(2);
    });

    it('leaves a dictionary page to describe itself', () => {
        expect(routeSeo('/vocab/1589350')).not.toHaveProperty('page');
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

    // routeSeo keeps its own list of app screens under the detail prefixes (GRAMMAR_SCREENS);
    // a screen added to App and not there would be canonical to a dictionary page that is not.
    it('keeps every fixed app route under a detail prefix out of the index', () => {
        const fixed = APP_ROUTES.filter(path => /^\/(grammar|vocab|kanji)\/[^:]/.test(path) && !path.includes(':'));
        expect(fixed).toContain('/grammar/chapters');
        for (const path of fixed) expect(routeSeo(path), path).toEqual({ kind: 'noindex' });
    });

    it('points every parameterised detail route at a dictionary page', () => {
        const detail = APP_ROUTES.filter(path => /^\/(grammar|vocab|kanji)\//.test(path) && path.includes(':'));
        expect(detail.length).toBeGreaterThan(0);
        for (const path of detail) {
            const seo = routeSeo(path.replace(/:[a-zA-Z]+/g, 'x'));
            expect(seo.kind === 'canonical' && seo.path.startsWith('/dictionary/'), path).toBe(true);
        }
    });

    it('never guesses a dictionary page for a path that is not one entry', () => {
        expect(routeSeo('/vocab/1/extra')).toEqual({ kind: 'noindex' });
        expect(routeSeo('/kanji/%E5%AD')).toEqual({ kind: 'noindex' });
    });
});

describe('isAboutPath', () => {
    it('recognises About with or without a trailing slash, and nothing else', () => {
        expect(isAboutPath('/about')).toBe(true);
        expect(isAboutPath('/about/')).toBe(true);
        expect(isAboutPath('/')).toBe(false);
        expect(isAboutPath('/about/x')).toBe(false);
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

    // React places a route's <title> before the first one in <head>, so one default is
    // overridden; any other per-page tag here would sit beside the route's as a duplicate.
    it('declares one default title, and no description of its own', () => {
        expect([...html.matchAll(/<title>/g)]).toHaveLength(1);
        expect(html).toContain(`<title>${PUBLIC_HOME_TITLE}</title>`);
        for (const tag of ['name="title"', 'name="description"', 'property="og:title"', 'property="og:description"', 'name="twitter:title"', 'name="twitter:description"']) {
            expect(html, tag).not.toContain(tag);
        }
    });

    it('names the dictionary as nearly 36,000 words, everywhere it counts them', () => {
        const counts = [...html.matchAll(/(\d+,\d{3}) words/g)].map(match => match[1]);
        expect(counts.length).toBeGreaterThan(1);
        expect(new Set(counts)).toEqual(new Set(['36,000']));
        expect(html).not.toContain('38,000');
    });
});
