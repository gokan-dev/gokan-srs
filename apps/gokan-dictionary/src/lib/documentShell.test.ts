import { describe, it, expect } from 'vitest';
import { chineseWithoutLang, englishChromeOn, englishWithoutLang, escapeHtml, japaneseWithoutLang, langOf, langOnChinesePage, linksLeavingSection, renderDocument, stripHydrationMarkers } from './documentShell';
import { absoluteUrl, localeUrls } from './urls';

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
        lang: 'en',
        title: '思う - Gokan Dictionary',
        description: 'to think, to consider',
        canonicalPath: localeUrls('en').vocabPath('1589350'),
        bodyHtml: '<main>hello</main>',
        stylesheetHref: '/assets/styles-abc123.css',
    };

    it('lists every alternate after the canonical link, and none for a page in one language', () => {
        const html = renderDocument({ ...base, alternates: [{ hreflang: 'en', path: '/dictionary/' }, { hreflang: 'zh-Hans', path: '/dictionary/zh-hans/' }] });
        expect(html).toContain('<link rel="alternate" hreflang="en" href="https://gokan-srs.com/dictionary/" />\n<link rel="alternate" hreflang="zh-Hans" href="https://gokan-srs.com/dictionary/zh-hans/" />\n<link rel="icon"');
        expect(renderDocument(base)).not.toContain('rel="alternate"');
    });

    it('includes an escaped title and description', () => {
        const html = renderDocument({ ...base, title: '<script>alert(1)</script>' });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('names the page language on <html>', () => {
        expect(renderDocument(base)).toContain('<html lang="en">');
        expect(renderDocument({ ...base, lang: 'zh-Hans' })).toContain('<html lang="zh-Hans">');
    });

    it('resolves the canonical path to an absolute URL', () => {
        const html = renderDocument(base);
        const canonical = absoluteUrl(localeUrls('en').vocabPath('1589350'));
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
        lang: 'en',
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
    const base = { lang: 'en', title: 'Search', description: 'd', canonicalPath: '/dictionary/search/', bodyHtml: '', stylesheetHref: '/s.css' };

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
        const html = renderDocument({ lang: 'en', title: 't', description: 'd', canonicalPath: '/', bodyHtml: '<p><!--[-->x<!--]--></p>', stylesheetHref: '/s.css' });
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

    it('reads the body in the document\'s language: Chinese may hold Han characters, never kana alone', () => {
        const chinese = (body: string) => `<html lang="zh-Hans"><head><title>t</title></head><body>${body}</body></html>`;
        expect(japaneseWithoutLang(chinese('<p>公然、显然</p><p>去，到；行く的尊敬语</p>'))).toEqual([]);
        expect(japaneseWithoutLang(chinese('<p>はい</p>'))).toEqual(['はい']);
        expect(japaneseWithoutLang(chinese('<p lang="en">公然</p>'))).toEqual(['公然']);
        expect(japaneseWithoutLang('<html lang="en"><body><p>公然</p></body></html>')).toEqual(['公然']);
    });

    it('ignores the head and script contents', () => {
        const html = '<html><head><title>食べる</title></head><body><script type="application/ld+json">{"name":"食べる"}</script><p lang="ja">食べる</p></body></html>';
        expect(japaneseWithoutLang(html)).toEqual([]);
    });
});

describe('langOnChinesePage', () => {
    it('marks kana-only text as Japanese and Latin-only text as English, leaving Chinese and Chinese quoting Japanese alone', () => {
        expect(langOnChinesePage('ずるいさ')).toBe('ja');
        expect(langOnChinesePage('‐ている')).toBe('ja');
        expect(langOnChinesePage('狡猾，奸诈。')).toBeUndefined();
        expect(langOnChinesePage('去，到；行く的尊敬语')).toBeUndefined();
        expect(langOnChinesePage('idiomatic')).toBe('en');
        expect(langOnChinesePage('CPU的简称')).toBeUndefined();
    });
});

describe('langOf', () => {
    it('marks Japanese-only text as Japanese, leaving English and mixed text alone', () => {
        expect(langOf('から / ので')).toBe('ja');
        expect(langOf('Giving a reason')).toBeUndefined();
        expect(langOf('Topic, identity and の')).toBeUndefined();
    });
});

const chinese = (body: string) => `<html lang="zh-Hans"><body>${body}</body></html>`;

describe('englishWithoutLang', () => {
    it("finds English read as Chinese anywhere in the body: the dataset's, or chrome left untranslated", () => {
        expect(englishWithoutLang(chinese('<ol class="sense-list"><li><p class="sense-pos">Noun</p>wise; clever</li></ol>'))).toEqual(['Noun', 'wise; clever']);
        expect(englishWithoutLang(chinese('<p class="sentence-en">I think so.</p>'))).toEqual(['I think so.']);
        expect(englishWithoutLang(chinese('<h2>Meanings</h2><p class="meta">Also written</p>'))).toEqual(['Meanings', 'Also written']);
    });

    it('accepts English marked lang="en", Chinese or Japanese text, and the names that stand in any language', () => {
        expect(englishWithoutLang(chinese('<ol class="sense-list" lang="en"><li>wise</li></ol><p class="sentence-en" lang="en">I think so.</p>'))).toEqual([]);
        expect(englishWithoutLang(chinese('<ol class="sense-list"><li>聪明；CPU</li></ol><p class="sentence-en">我也这么想。</p>'))).toEqual([]);
        expect(englishWithoutLang(chinese('<a class="chip">JLPT N5</a><a href="/">gokan-dataset</a><a href="/">Gokan SRS</a><p>来源：Tatoeba</p>'))).toEqual([]);
    });

    it("leaves an English page's body alone", () => {
        expect(englishWithoutLang('<html lang="en"><body><ol class="sense-list"><li>wise</li></ol></body></html>')).toEqual([]);
    });
});

describe('englishChromeOn', () => {
    const english = ['Meanings', 'Search the dictionary', 'Common word'];

    it("finds English's chrome on a page, marked lang=\"en\" or not, in a text run or an accessible name", () => {
        expect(englishChromeOn(chinese('<h2>Meanings</h2><p lang="en"> Common word </p><label aria-label="Search the dictionary"></label>'), english))
            .toEqual(['Meanings', 'Common word', 'Search the dictionary']);
    });

    it("leaves the dataset's English alone, where a gloss may read like a label", () => {
        expect(englishChromeOn(chinese('<ol class="sense-list" lang="en"><li>Common word</li></ol><ul class="entry-list"><li><a><span lang="en">Meanings</span></a></li></ul>'), english)).toEqual([]);
    });
});

describe('chineseWithoutLang', () => {
    const own = ['又读', '词义', '活用', '想'];

    it("finds the page's own words standing in another language's element", () => {
        expect(chineseWithoutLang(chinese('<p class="entry-sub" lang="ja">おもう<span class="meta"> · 又读 <span lang="ja">おもふ</span></span></p>'), own)).toEqual(['· 又读']);
    });

    it("accepts them in the page's language, and the dataset's Japanese however it reads", () => {
        expect(chineseWithoutLang(chinese('<h2>词义</h2><p lang="ja"><span lang="zh-Hans">又读</span></p>'), own)).toEqual([]);
        expect(chineseWithoutLang(chinese('<p class="sentence-jp" lang="ja"><a>活用</a>する</p><nav><span lang="ja">活用</span></nav>'), own)).toEqual([]);
    });

    it('looks only for strings of two characters or more with a Chinese one', () => {
        expect(chineseWithoutLang(chinese('<p lang="ja"><a>想</a></p>'), own)).toEqual([]);
    });
});

describe('linksLeavingSection', () => {
    const root = '/dictionary/zh-hans/';

    it('finds a link out of the section that does not say where it leads', () => {
        expect(linksLeavingSection(chinese('<a href="/dictionary/kanji/%E5%AD%A6/">学</a><a href="https://github.com/">x</a>'), root))
            .toEqual(['<a href="/dictionary/kanji/%E5%AD%A6/">', '<a href="https://github.com/">']);
    });

    it('accepts a link in the section, one marked with hreflang, and an in-page anchor', () => {
        expect(linksLeavingSection(chinese('<a href="/dictionary/zh-hans/vocab/1/">x</a><a href="/dictionary/vocab/1/" hreflang="en">English</a><a href="#content">x</a>'), root)).toEqual([]);
    });
});
