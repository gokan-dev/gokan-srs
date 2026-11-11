import { describe, expect, it } from 'vitest';
import { inSection, linkLang, linkUrls } from './localeLinks';
import { localeUrls } from './urls';

describe('linkUrls', () => {
    it("links a Chinese page's words and lists in Chinese, and the page types Chinese has not yet to English's", () => {
        const urls = linkUrls('zh-hans');
        const [chinese, english] = [localeUrls('zh-hans'), localeUrls('en')];
        expect([urls.homePath(), urls.vocabIndexPath(), urls.vocabJlptPath(3, 2), urls.vocabPath('1'), urls.searchPath(), urls.searchPath('想')])
            .toEqual([chinese.homePath(), chinese.vocabIndexPath(), chinese.vocabJlptPath(3, 2), chinese.vocabPath('1'), chinese.searchPath(), chinese.searchPath('想')]);
        expect([urls.kanjiPath('賢'), urls.kanjiIndexPath(), urls.kanjiOrdersPath(), urls.grammarIndexPath(), urls.grammarPath('n5-001')])
            .toEqual([english.kanjiPath('賢'), english.kanjiIndexPath(), english.kanjiOrdersPath(), english.grammarIndexPath(), english.grammarPath('n5-001')]);
    });

    it("gives an English page English's paths", () => {
        const [urls, english] = [linkUrls('en'), localeUrls('en')];
        expect([urls.homePath(), urls.vocabPath('1'), urls.kanjiPath('学')]).toEqual([english.homePath(), english.vocabPath('1'), english.kanjiPath('学')]);
    });
});

describe('linkLang', () => {
    const urls = linkUrls('zh-hans');

    it('marks a Chinese page\'s link that leaves its section as English', () => {
        expect(linkLang('zh-hans', urls.kanjiPath('学'))).toBe('en');
        expect(linkLang('zh-hans', 'https://github.com/gokan-dev/gokan-dataset')).toBe('en');
        expect(linkLang('zh-hans', urls.vocabPath('1'))).toBeUndefined();
        expect(inSection('zh-hans', urls.vocabJlptPath(5))).toBe(true);
    });

    it('marks nothing on an English page', () => {
        expect(linkLang('en', 'https://github.com/gokan-dev/gokan-dataset')).toBeUndefined();
    });
});
