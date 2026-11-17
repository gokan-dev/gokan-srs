import { describe, expect, it } from 'vitest';
import { appUrl } from './appLinks';
import { SITE_ORIGIN } from './site';

describe('appUrl', () => {
    it('opens the app\'s root, naming the placement for Umami, with no setup of its own', () => {
        expect(appUrl({ placement: 'footer' })).toEqual({
            href: `${SITE_ORIGIN}/?utm_source=dictionary&utm_content=footer`,
            placement: 'footer',
        });
    });

    it('carries the order and kanji count onboarding opens on (gokan-srs #243)', () => {
        expect(appUrl({ placement: 'range', order: 'kklc', known: 300 }).href)
            .toBe(`${SITE_ORIGIN}/?order=kklc&known=300&utm_source=dictionary&utm_content=range`);
        expect(appUrl({ placement: 'order', order: 'rtk' }).href)
            .toBe(`${SITE_ORIGIN}/?order=rtk&utm_source=dictionary&utm_content=order`);
    });

    it('opens an app page once setup is done', () => {
        expect(appUrl({ placement: 'word', vocabId: '1358280', order: 'kklc', known: 212 }).href)
            .toBe(`${SITE_ORIGIN}/vocab/1358280?order=kklc&known=212&utm_source=dictionary&utm_content=word`);
    });
});
