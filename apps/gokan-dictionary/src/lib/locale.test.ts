import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, datasetLanguageOf, htmlLang, inEveryLocale, isLocaleSegment, localeOfSegment, localePrefix, SERVED_LOCALES } from './locale';

describe('locale', () => {
    it('serves English only, at the paths the site has always had', () => {
        expect(SERVED_LOCALES).toEqual(['en']);
        expect(DEFAULT_LOCALE).toBe('en');
        expect(localePrefix('en')).toBe('');
        expect(localePrefix('zh-hans')).toBe('/zh-hans');
    });

    it('matches no segment while only English is served: never "en", never a locale not yet served', () => {
        expect(isLocaleSegment('en')).toBe(false);
        expect(isLocaleSegment('zh-hans')).toBe(false);
        expect(isLocaleSegment('vocab')).toBe(false);
        expect(localeOfSegment(undefined)).toBe('en');
        expect(() => localeOfSegment('en')).toThrow(/not a locale segment/);
        expect(() => localeOfSegment('zh-hans')).toThrow(/not a locale segment/);
    });

    it('tags <html> with the BCP 47 name, and reads English text for English', () => {
        expect(htmlLang('en')).toBe('en');
        expect(htmlLang('zh-hans')).toBe('zh-Hans');
        expect(datasetLanguageOf('en')).toBe('en');
    });

    it('gives English entries without a locale segment', async () => {
        const entries = await inEveryLocale(locale => Promise.resolve([{ id: `${locale}-1` }]));
        expect(entries).toEqual([{ id: 'en-1' }]);
    });
});
