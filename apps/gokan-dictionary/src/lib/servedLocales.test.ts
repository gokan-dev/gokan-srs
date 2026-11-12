import { describe, expect, it } from 'vitest';
import { isLocaleSegmentOf, servedLocaleNamedIn, servedLocalesOf } from './servedLocales';

describe('servedLocalesOf', () => {
    it('is English alone when the setting is unset or blank', () => {
        expect(servedLocalesOf(undefined)).toEqual(['en']);
        expect(servedLocalesOf('  ')).toEqual(['en']);
    });

    it('gives the named locales in the known order', () => {
        expect(servedLocalesOf('zh-hans en')).toEqual(['en', 'zh-hans']);
    });

    it('refuses an unknown name and a list without English', () => {
        expect(() => servedLocalesOf('en fr')).toThrow(/"fr"/);
        expect(() => servedLocalesOf('zh-hans')).toThrow(/English is always served/);
    });
});

describe('isLocaleSegmentOf and servedLocaleNamedIn', () => {
    const served = servedLocalesOf('en zh-hans');

    it('takes a served locale other than English as a URL segment', () => {
        expect(isLocaleSegmentOf(served, 'zh-hans')).toBe(true);
        expect(isLocaleSegmentOf(served, 'en')).toBe(false);
        expect(isLocaleSegmentOf(servedLocalesOf('en'), 'zh-hans')).toBe(false);
    });

    it('names a served locale, English included', () => {
        expect(servedLocaleNamedIn(served, 'en')).toBe('en');
        expect(servedLocaleNamedIn(served, 'zh-hans')).toBe('zh-hans');
        expect(servedLocaleNamedIn(servedLocalesOf('en'), 'zh-hans')).toBeUndefined();
    });
});