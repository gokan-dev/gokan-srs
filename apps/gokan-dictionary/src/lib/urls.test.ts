import { describe, it, expect } from 'vitest';
import {
    vocabPath,
    kanjiPath,
    grammarPath,
    grammarIndexPath,
    grammarChaptersIndexPath,
    grammarChapterPath,
    grammarFamilyPath,
    grammarConjugationsIndexPath,
    homePath,
    assetPath,
    searchIndexPaths,
    searchPath,
    vocabJlptPath,
    grammarFamiliesIndexPath,
    absoluteUrl,
    kanjiOrdersPath,
    kanjiOrderPath,
    kanjiOrderSlug,
    kanjiRangePath,
    kanjiStepPath,
} from './urls';
import { BASE_PATH, SITE_ORIGIN } from './site';

// These assert against the DEFAULT build config (subfolder mode, '/dictionary'), which is what
// production ships. BASE_PATH is interpolated rather than hardcoded so that flipping the env
// var for a subdomain build doesn't turn every one of these into a false failure - the
// invariant under test is "every path carries the base prefix exactly once", not the literal.
describe('path builders', () => {
    it('prefixes the base path exactly once', () => {
        expect(vocabPath('1589350')).toBe(`${BASE_PATH}/vocab/1589350/`);
        expect(kanjiPath('日')).toBe(`${BASE_PATH}/kanji/%E6%97%A5/`);
        expect(grammarPath('n5-001')).toBe(`${BASE_PATH}/grammar/n5-001/`);
        expect(grammarIndexPath()).toBe(`${BASE_PATH}/grammar/`);
        expect(grammarChaptersIndexPath()).toBe(`${BASE_PATH}/grammar/chapters/`);
        expect(grammarChapterPath('n5-c01')).toBe(`${BASE_PATH}/grammar/chapters/n5-c01/`);
        expect(grammarFamilyPath('causality')).toBe(`${BASE_PATH}/grammar/family/causality/`);
        expect(grammarConjugationsIndexPath()).toBe(`${BASE_PATH}/grammar/conjugations/`);
        expect(homePath()).toBe(`${BASE_PATH}/`);
        expect(grammarFamiliesIndexPath()).toBe(`${BASE_PATH}/grammar/families/`);
        expect(searchIndexPaths()).toEqual({ core: `${BASE_PATH}/data/search-core.json`, full: `${BASE_PATH}/data/search-full.json` });
    });

    it('numbers JLPT list pages from the second one', () => {
        expect(vocabJlptPath(1)).toBe(`${BASE_PATH}/vocab/jlpt-n1/`);
        expect(vocabJlptPath(1, 1)).toBe(`${BASE_PATH}/vocab/jlpt-n1/`);
        expect(vocabJlptPath(1, 3)).toBe(`${BASE_PATH}/vocab/jlpt-n1/3/`);
    });

    it('puts the kanji orders under the kanji, an order in kebab case, a range by its steps', () => {
        expect(kanjiOrdersPath()).toBe(`${BASE_PATH}/kanji/orders/`);
        expect(kanjiOrderPath('kklc')).toBe(`${BASE_PATH}/kanji/orders/kklc/`);
        expect(kanjiOrderSlug('kanjiInContext')).toBe('kanji-in-context');
        expect(kanjiOrderPath('rtkLegacy')).toBe(`${BASE_PATH}/kanji/orders/rtk-legacy/`);
        expect(kanjiRangePath('kklc', { first: 1, last: 100 })).toBe(`${BASE_PATH}/kanji/orders/kklc/1-100/`);
        expect(kanjiRangePath('henshall', { first: 1901, last: 1945 })).toBe(`${BASE_PATH}/kanji/orders/henshall/1901-1945/`);
        expect(kanjiStepPath('kklc', { first: 301, last: 400 }, 340)).toBe(`${BASE_PATH}/kanji/orders/kklc/301-400/#step-340`);
    });

    it('puts a search query in the results page URL, encoded', () => {
        expect(searchPath()).toBe(`${BASE_PATH}/search/`);
        expect(searchPath('食べ る&')).toBe(`${BASE_PATH}/search/?q=%E9%A3%9F%E3%81%B9%20%E3%82%8B%26`);
    });

    it('defaults to the subfolder deployment', () => {
        expect(BASE_PATH).toBe('/dictionary');
    });

    it('encodes characters that are not URL-safe on their own', () => {
        const path = kanjiPath('文');
        const encoded = path.slice(`${BASE_PATH}/kanji/`.length, -1);
        expect(decodeURIComponent(encoded)).toBe('文');
    });

    it('builds asset hrefs under the base path without doubling the slash', () => {
        expect(assetPath('assets/styles-BMo4ay5S.css')).toBe(`${BASE_PATH}/assets/styles-BMo4ay5S.css`);
        expect(assetPath('/assets/styles-BMo4ay5S.css')).toBe(`${BASE_PATH}/assets/styles-BMo4ay5S.css`);
    });
});

describe('absoluteUrl', () => {
    it('resolves an already-prefixed path against the bare origin', () => {
        // Regression guard: resolving against a base that itself has a path (the site URL) silently
        // drops that path for absolute inputs, which would emit canonicals missing /dictionary.
        expect(absoluteUrl(vocabPath('1589350'))).toBe(`${SITE_ORIGIN}${BASE_PATH}/vocab/1589350/`);
    });

    it('resolves the home path to the origin plus base path', () => {
        expect(absoluteUrl(homePath())).toBe(`${SITE_ORIGIN}${BASE_PATH}/`);
    });

    it('does not double-encode percent-escaped segments', () => {
        expect(absoluteUrl(`${BASE_PATH}/kanji/%E6%80%9D/`)).toBe(`${SITE_ORIGIN}${BASE_PATH}/kanji/%E6%80%9D/`);
    });
});
