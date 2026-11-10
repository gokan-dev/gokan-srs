import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, datasetLanguageOf, htmlLang, inEveryLocale, isLocaleSegment, localeOfSegment, localePrefix, SERVED_LOCALES, servedLocalesOf } from './locale';
import { DICTIONARY_LOCALES } from './site';

// What this run serves is the environment's (CI builds `en zh-hans`, a laptop English alone), so
// the tests below hold each case to the setting rather than assume one.
const servesChinese = SERVED_LOCALES.includes('zh-hans');

describe('servedLocalesOf', () => {
    it('is English alone when unset or blank, and the build setting otherwise', () => {
        expect(servedLocalesOf(undefined)).toEqual(['en']);
        expect(servedLocalesOf('  ')).toEqual(['en']);
        expect(servedLocalesOf('en')).toEqual(['en']);
        expect(servedLocalesOf('en zh-hans')).toEqual(['en', 'zh-hans']);
        // In the locales' own order, once each.
        expect(servedLocalesOf(' zh-hans  en zh-hans ')).toEqual(['en', 'zh-hans']);
        expect(SERVED_LOCALES).toEqual(servedLocalesOf(DICTIONARY_LOCALES));
    });

    it('fails on a locale it does not know, never falling back to English', () => {
        expect(() => servedLocalesOf('en zh-hant')).toThrow(/"zh-hant", not a locale/);
        expect(() => servedLocalesOf('en,zh-hans')).toThrow(/not a locale/);
        expect(() => servedLocalesOf('zh-hans')).toThrow(/leaves out en/);
    });
});

describe('locale', () => {
    it('keeps English at the paths the site has always had', () => {
        expect(SERVED_LOCALES[0]).toBe('en');
        expect(DEFAULT_LOCALE).toBe('en');
        expect(localePrefix('en')).toBe('');
        expect(localePrefix('zh-hans')).toBe('/zh-hans');
    });

    it('matches a served locale\'s segment only: never "en", never a locale not served', () => {
        expect(isLocaleSegment('en')).toBe(false);
        expect(isLocaleSegment('vocab')).toBe(false);
        expect(isLocaleSegment('zh-hans')).toBe(servesChinese);
        expect(localeOfSegment(undefined)).toBe('en');
        expect(() => localeOfSegment('en')).toThrow(/not a locale segment/);
        if (servesChinese) expect(localeOfSegment('zh-hans')).toBe('zh-hans');
        else expect(() => localeOfSegment('zh-hans')).toThrow(/not a locale segment/);
    });

    it('tags <html> with the BCP 47 name, and reads each locale\'s own text', () => {
        expect(htmlLang('en')).toBe('en');
        expect(htmlLang('zh-hans')).toBe('zh-Hans');
        expect(datasetLanguageOf('en')).toBe('en');
        expect(datasetLanguageOf('zh-hans')).toBe('zh-hans');
    });

    it('gives English entries without a locale segment, another locale\'s with its own', async () => {
        const entries = await inEveryLocale(locale => Promise.resolve([{ id: `${locale}-1` }]));
        expect(entries).toEqual([{ id: 'en-1' }, ...(servesChinese ? [{ id: 'zh-hans-1', locale: 'zh-hans' }] : [])]);
    });
});
