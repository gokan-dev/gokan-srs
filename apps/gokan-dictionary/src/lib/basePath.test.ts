import { describe, expect, it } from 'vitest';
import { withoutBasePath } from './basePath';

describe('withoutBasePath', () => {
    it('drops the base from a path under it, the base itself becoming the root', () => {
        expect(withoutBasePath('/dictionary', '/dictionary')).toBe('/');
        expect(withoutBasePath('/dictionary/', '/dictionary')).toBe('/');
        expect(withoutBasePath('/dictionary/vocab/1589350/', '/dictionary')).toBe('/vocab/1589350/');
    });

    it('leaves a path outside the base as it is, a prefix that is not a segment included', () => {
        expect(withoutBasePath('/vocab/1589350/', '/dictionary')).toBe('/vocab/1589350/');
        expect(withoutBasePath('/dictionaryx/vocab/', '/dictionary')).toBe('/dictionaryx/vocab/');
    });

    it('changes nothing when the site has no base path', () => {
        expect(withoutBasePath('/vocab/1589350/', '')).toBe('/vocab/1589350/');
        expect(withoutBasePath('/', '')).toBe('/');
    });
});
