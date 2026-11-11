import { describe, expect, it } from 'vitest';
import { alternateProblems, alternatesIn, brokenLinks } from './builtLinks';

const built = new Set(['index.html', 'vocab/1/index.html', 'kanji/賢/index.html', 'zh-hans/vocab/1/index.html', 'assets/app.css']);
const exists = (file: string) => built.has(file);

describe('brokenLinks', () => {
    it('finds each internal link that names no built page or file, once', () => {
        const html = '<a href="/dictionary/zh-hans/">x</a><a href="/dictionary/zh-hans/vocab/2/">y</a><a href="/dictionary/zh-hans/">x</a>';
        expect(brokenLinks(html, '/dictionary', exists)).toEqual(['/dictionary/zh-hans/', '/dictionary/zh-hans/vocab/2/']);
    });

    it('resolves pages to their index.html, encoded paths, queries, fragments and files', () => {
        const html = '<link href="/dictionary/assets/app.css"><a href="/dictionary/">h</a><a href="/dictionary/kanji/%E8%B3%A2/#top">k</a><a href="/dictionary/vocab/1/?q=a&amp;b">v</a><a href="/dictionary/zh-hans/vocab/1/">z</a>';
        expect(brokenLinks(html, '/dictionary', exists)).toEqual([]);
    });

    it('leaves links outside the site alone', () => {
        expect(brokenLinks('<a href="/">app</a><a href="https://example.org/">x</a><a href="#content">s</a>', '/dictionary', exists)).toEqual([]);
        expect(brokenLinks('<a href="//cdn.example/x">x</a><a href="/zh-hans/">z</a>', '', exists)).toEqual(['/zh-hans/']);
    });
});

describe('alternateProblems', () => {
    const origin = 'https://gokan-srs.com';
    const head = (alternates: Record<string, string>) => Object.entries(alternates)
        .map(([hreflang, path]) => `<link rel="alternate" hreflang="${hreflang}" href="${origin}${path}" />`).join('\n');
    const both = { en: '/dictionary/vocab/1/', 'zh-Hans': '/dictionary/zh-hans/vocab/1/', 'x-default': '/dictionary/vocab/1/' };
    const site = (files: Record<string, string>) => (file: string) => files[file] ?? null;

    it('reads a page\'s alternates by hreflang', () => {
        expect(alternatesIn(head(both)).get('zh-Hans')).toBe(`${origin}/dictionary/zh-hans/vocab/1/`);
    });

    it('accepts two pages that list each other, and a page with none', () => {
        const read = site({ 'vocab/1/index.html': head(both), 'zh-hans/vocab/1/index.html': head(both), 'vocab/2/index.html': '<p></p>' });
        expect(alternateProblems('zh-hans/vocab/1/index.html', read, origin, '/dictionary')).toEqual([]);
        expect(alternateProblems('vocab/2/index.html', read, origin, '/dictionary')).toEqual([]);
    });

    it('finds an alternate not built, one not listing the page back, and a page not listing itself', () => {
        const oneWay = site({ 'zh-hans/vocab/1/index.html': head(both), 'vocab/1/index.html': head({ en: '/dictionary/vocab/1/' }) });
        expect(alternateProblems('zh-hans/vocab/1/index.html', oneWay, origin, '/dictionary')).toEqual([
            `zh-hans/vocab/1/index.html lists en ${origin}/dictionary/vocab/1/, which does not list the same alternates back`,
        ]);
        expect(alternateProblems('zh-hans/vocab/1/index.html', site({ 'zh-hans/vocab/1/index.html': head(both) }), origin, '/dictionary')).toEqual([
            `zh-hans/vocab/1/index.html lists en ${origin}/dictionary/vocab/1/, which is not built`,
        ]);
        expect(alternateProblems('vocab/3/index.html', site({ 'vocab/3/index.html': head(both) }), origin, '/dictionary')[0]).toBe('vocab/3/index.html does not list itself among its alternates');
    });
});
