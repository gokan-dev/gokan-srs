import { describe, expect, it } from 'vitest';
import { brokenLinks } from './builtLinks';

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
