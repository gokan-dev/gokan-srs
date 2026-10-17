import { describe, it, expect } from 'vitest';
import { escapeHtml, japaneseWithoutLang, langOf, renderDocument, stripHydrationMarkers } from './documentShell';
import { vocabPath, absoluteUrl } from './urls';

describe('escapeHtml', () => {
    it('escapes the five HTML-significant characters', () => {
        expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    });

    it('leaves plain text untouched', () => {
        expect(escapeHtml('思う')).toBe('思う');
    });
});

describe('renderDocument', () => {
    const base = {
        title: '思う - Gokan Dictionary',
        description: 'to think, to consider',
        canonicalPath: vocabPath('1589350'),
        bodyHtml: '<main>hello</main>',
        stylesheetHref: '/assets/styles-abc123.css',
    };

    it('includes an escaped title and description', () => {
        const html = renderDocument({ ...base, title: '<script>alert(1)</script>' });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('resolves the canonical path to an absolute URL', () => {
        const html = renderDocument(base);
        const canonical = absoluteUrl(vocabPath('1589350'));
        expect(canonical).toContain('/dictionary/vocab/1589350/');
        expect(html).toContain(`<link rel="canonical" href="${canonical}" />`);
        expect(html).toContain(`<meta property="og:url" content="${canonical}" />`);
    });

    it('has no analytics script unless the build has a website id', () => {
        expect(renderDocument(base)).not.toContain('umami');
        expect(renderDocument({ ...base, analyticsWebsiteId: '0b6c2a1e-4f7d-4c39-9d2a-6e1f5b8c3a90' })).toContain(
            'data-website-id="0b6c2a1e-4f7d-4c39-9d2a-6e1f5b8c3a90" data-domains="gokan-srs.com"></script></head>',
        );
    });

    it('links the stylesheet', () => {
        const html = renderDocument(base);
        expect(html).toContain('<link rel="stylesheet" href="/assets/styles-abc123.css" />');
    });

    it('omits the script tag when scriptHref is not provided', () => {
        const html = renderDocument(base);
        expect(html).not.toContain('<script type="module"');
    });

    it('includes the script tag when scriptHref is provided', () => {
        const html = renderDocument({ ...base, scriptHref: '/assets/search-xyz.js' });
        expect(html).toContain('<script type="module" src="/assets/search-xyz.js"></script>');
    });

    it('embeds structuredData as JSON-LD when provided', () => {
        const html = renderDocument({ ...base, structuredData: { '@type': 'DefinedTerm', name: '思う' } });
        expect(html).toContain('<script type="application/ld+json">{"@type":"DefinedTerm","name":"思う"}</script>');
    });

    it('omits the JSON-LD script when structuredData is not provided', () => {
        const html = renderDocument(base);
        expect(html).not.toContain('application/ld+json');
    });

    it('embeds the body HTML verbatim', () => {
        const html = renderDocument(base);
        expect(html).toContain('<main>hello</main>');
    });
});

describe('extraScriptHref', () => {
    const base = {
        title: 'Grammar',
        description: 'Grammar points',
        canonicalPath: '/dictionary/grammar/',
        bodyHtml: '<main>x</main>',
        stylesheetHref: '/assets/styles.css',
    };

    it('links a second module script alongside the first', () => {
        // The grammar index is the only page with two scripts: the shared search box plus its
        // own filter. A regression here silently ships a page whose filter never appears.
        const html = renderDocument({ ...base, scriptHref: '/a.js', extraScriptHref: '/b.js' });
        expect(html).toContain('<script type="module" src="/a.js"></script>');
        expect(html).toContain('<script type="module" src="/b.js"></script>');
    });

    it('omits it when not provided', () => {
        const html = renderDocument({ ...base, scriptHref: '/a.js' });
        expect(html).toContain('src="/a.js"');
        expect(html.match(/<script type="module"/g)).toHaveLength(1);
    });
});

describe('noindex', () => {
    const base = { title: 'Search', description: 'd', canonicalPath: '/dictionary/search/', bodyHtml: '', stylesheetHref: '/s.css' };

    it('keeps a page out of search engines when asked', () => {
        expect(renderDocument({ ...base, noindex: true })).toContain('<meta name="robots" content="noindex" />');
        expect(renderDocument(base)).not.toContain('noindex');
    });
});

describe('stripHydrationMarkers', () => {
    it('drops Svelte block markers and keeps the markup', () => {
        expect(stripHydrationMarkers('<ul><!--[--><li>a</li><!--[!--><li>b</li><!--[0--><i>c</i><!--[-1--><!--]--><!----></ul>')).toBe('<ul><li>a</li><li>b</li><i>c</i></ul>');
    });

    it('is applied to the rendered body', () => {
        const html = renderDocument({ title: 't', description: 'd', canonicalPath: '/', bodyHtml: '<p><!--[-->x<!--]--></p>', stylesheetHref: '/s.css' });
        expect(html).toContain('<p>x</p>');
    });
});

describe('japaneseWithoutLang', () => {
    it('finds elements with the jp class that are not marked as Japanese', () => {
        const html = '<span class="jp" lang="ja">語</span><a class="title jp" href="/">語</a><p class="jpx">x</p>';
        expect(japaneseWithoutLang(html)).toContain('<a class="title jp" href="/">');
    });

    it('finds Japanese text outside any lang="ja" element', () => {
        expect(japaneseWithoutLang('<body><p><a href="/">食べる</a></p></body>')).toEqual(['食べる']);
    });

    it('accepts Japanese inside a lang="ja" ancestor, through nested and void elements', () => {
        const html = '<body><p lang="ja"><a href="/"><ruby>食<rt>た</rt></ruby>べる</a><br>私</p></body>';
        expect(japaneseWithoutLang(html)).toEqual([]);
    });

    it('lets an English sentence quote a word, and a lang="en" child switch back', () => {
        expect(japaneseWithoutLang('<body><p>Use から for a reason.</p><p lang="ja">はい<span lang="en">yes</span></p></body>')).toEqual([]);
        expect(japaneseWithoutLang('<body><p lang="ja"><span lang="en">はい</span></p></body>')).toEqual(['はい']);
    });

    it('ignores the head and script contents', () => {
        const html = '<html><head><title>食べる</title></head><body><script type="application/ld+json">{"name":"食べる"}</script><p lang="ja">食べる</p></body></html>';
        expect(japaneseWithoutLang(html)).toEqual([]);
    });
});

describe('langOf', () => {
    it('marks Japanese-only text as Japanese, leaving English and mixed text alone', () => {
        expect(langOf('から / ので')).toBe('ja');
        expect(langOf('Giving a reason')).toBeUndefined();
        expect(langOf('Topic, identity and の')).toBeUndefined();
    });
});
