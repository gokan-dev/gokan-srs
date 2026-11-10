import { describe, expect, it } from 'vitest';
import { linkUrls } from './localeLinks';
import { localeUrls } from './urls';

describe('linkUrls', () => {
    it("links a Chinese page's words with a Chinese page there, and everything else to English's pages", () => {
        const urls = linkUrls('zh-hans', new Set(['1']));
        const english = localeUrls('en');
        expect(urls.vocabPath('1')).toBe(localeUrls('zh-hans').vocabPath('1'));
        expect(urls.vocabPath('2')).toBe(english.vocabPath('2'));
        expect([urls.homePath(), urls.vocabIndexPath(), urls.vocabJlptPath(3), urls.kanjiPath('賢'), urls.grammarIndexPath(), urls.searchPath()])
            .toEqual([english.homePath(), english.vocabIndexPath(), english.vocabJlptPath(3), english.kanjiPath('賢'), english.grammarIndexPath(), english.searchPath()]);
    });

    it("gives an English page English's paths, whatever it is told", () => {
        expect(linkUrls('en', new Set(['1'])).vocabPath('1')).toBe(localeUrls('en').vocabPath('1'));
    });
});
