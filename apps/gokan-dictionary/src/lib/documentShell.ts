// Pure HTML-document builder: wraps a page's rendered body with the <head> (SEO meta, canonical
// link, JSON-LD, asset links) every page needs. The server hook (hooks.server.ts) applies it to
// what SvelteKit renders, so app.html carries only the body. Kept as plain string templating
// rather than <svelte:head>: a document shell isn't itself a piece of UI, and one template keeps
// every page's head byte for byte what it was under the static generator this replaced.

import { analyticsScriptTag } from '@gokan/analytics';
import { absoluteUrl, faviconPath } from './urls';

export interface DocumentShellOptions {
    /** <html lang>: the page's locale as a BCP 47 tag (htmlLang). */
    lang: string;
    title: string;
    description: string;
    /** Site-relative path, e.g. "/vocab/1589350/" - used for the canonical link and og:url. */
    canonicalPath: string;
    /**
     * The page in every language it is in, this one included, each with its hreflang ("en",
     * "zh-Hans", "x-default"): site-relative paths. Omitted for a page in one language only.
     */
    alternates?: { hreflang: string; path: string }[];
    bodyHtml: string;
    /** Absolute href to the built global stylesheet (from the Vite client manifest). */
    stylesheetHref: string;
    /**
     * Absolute href to this page type's own stylesheet, if it has one. Pages built entirely from
     * shared rules (the vocabulary hub and JLPT lists) pass nothing.
     */
    pageStylesheetHref?: string;
    /** Absolute href to the built search script, linked from every page (the header owns the box). */
    scriptHref?: string;
    /** A second module script, used only by the grammar index for its filter. */
    extraScriptHref?: string;
    /** Keep the page out of search engines (the /search/ results page). */
    noindex?: boolean;
    /** Optional schema.org JSON-LD object, serialized verbatim into a <script type="application/ld+json">. */
    structuredData?: object;
    /** Umami website id: production builds only, so no other build counts visits. */
    analyticsWebsiteId?: string;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Svelte's server renderer brackets blocks with comment markers (<!--[-->, <!--[0-->, <!--]-->)
 * that only hydration reads. These pages are never hydrated, so the markers are dropped: on a
 * list of 600 words they are a tenth of the page.
 */
export function stripHydrationMarkers(html: string): string {
    return html.replace(/<!--[[\]!\d-]*-->/g, '');
}

const VOID_ELEMENTS: ReadonlySet<string> = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff々]/;

const isJapaneseOnly = (text: string) => JAPANESE_TEXT.test(text) && !/[A-Za-z]/.test(text);

/**
 * "ja" for dataset text in Japanese only (a lesson titled "から / ので", a chapter summary listing
 * words), undefined for English or mixed text: for a `lang` attribute on text that can be either.
 */
export function langOf(text: string): 'ja' | undefined {
    return isJapaneseOnly(text) ? 'ja' : undefined;
}

const HAN = /[\u3400-\u9fff々]/;

/**
 * The lang dataset text needs on a Chinese page: "ja" for kana with no Han character (a Chinese
 * Wiktionary gloss or tag written in Japanese, ずるいさ), "en" for Latin letters with no Japanese or
 * Chinese character (a tag it writes in English, idiomatic), undefined for Chinese text, or Chinese
 * quoting a Japanese word. For a `lang` attribute, as langOf is on an English page.
 */
export function langOnChinesePage(text: string): 'ja' | 'en' | undefined {
    if (isJapaneseOnly(text) && !HAN.test(text)) return 'ja';
    return /[A-Za-z]/.test(text) && !JAPANESE_TEXT.test(text) ? 'en' : undefined;
}

/**
 * Whether a run in Japanese script only may stand in an element of `lang`: in Japanese, always;
 * in Chinese, unless it is kana alone (langOnChinesePage); in any other language, never.
 */
function readsAs(lang: string, text: string): boolean {
    if (lang === 'ja') return true;
    return lang.toLowerCase().startsWith('zh') && langOnChinesePage(text) === undefined;
}

/** Where a text run of a page's body stands: its nearest lang, and the classes of its ancestors. */
interface RunContext {
    lang: string;
    /** The lang of the run's own element, when it carries one. */
    ownLang: string | null;
    within: (className: string) => boolean;
}

/**
 * Walks a page's body: each text run with its context, each opening tag with its classes and
 * lang. Script contents are skipped (JSON-LD names the word). The nearest lang of the body is the
 * document's <html lang>.
 */
function walkBody(html: string, visit: { text?: (text: string, at: RunContext) => void; element?: (whole: string, classes: string[], lang: string | null) => void }): void {
    const bodyStart = html.indexOf('<body');
    const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
    const documentLang = /<html\b[^>]*\slang="([^"]*)"/.exec(html)?.[1] ?? 'en';
    const stack: { tag: string; lang: string | null; classes: string[] }[] = [];
    const context: RunContext = {
        get lang() {
            return [...stack].reverse().find(entry => entry.lang !== null)?.lang ?? documentLang;
        },
        get ownLang() {
            return stack.at(-1)?.lang ?? null;
        },
        within: className => stack.some(entry => entry.classes.includes(className)),
    };

    for (const token of body.matchAll(/<script\b[\s\S]*?<\/script>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)) {
        const [whole, closing, rawTag, attributes, text] = token;
        if (text !== undefined) {
            visit.text?.(text, context);
            continue;
        }
        if (rawTag === undefined) continue;
        const tag = rawTag.toLowerCase();
        if (closing) {
            const index = stack.map(entry => entry.tag).lastIndexOf(tag);
            if (index >= 0) stack.length = index;
            continue;
        }
        const classes = /\sclass="([^"]*)"/.exec(attributes)?.[1].split(/\s+/) ?? [];
        const lang = /\slang="([^"]*)"/.exec(attributes)?.[1] ?? null;
        visit.element?.(whole, classes, lang);
        if (!VOID_ELEMENTS.has(tag) && !whole.endsWith('/>')) stack.push({ tag, lang, classes });
    }
}

/**
 * Japanese in a page's body that is not marked as Japanese: an element with the `jp` class but
 * no lang="ja", or a text run in Japanese only (no Latin letters, so not an English sentence
 * quoting a word) whose nearest lang is not "ja" (on a Chinese page, see readsAs). Unmarked,
 * screen readers read it with an English voice and some devices draw it with Chinese glyph
 * shapes; prerender fails on any page this finds anything in.
 */
export function japaneseWithoutLang(html: string): string[] {
    const found: string[] = [];
    walkBody(html, {
        text: (text, at) => {
            if (isJapaneseOnly(text) && !readsAs(at.lang, text)) found.push(text.trim());
        },
        element: (whole, classes, lang) => {
            if (classes.includes('jp') && lang !== 'ja') found.push(whole);
        },
    });
    return found;
}

/** Where the dataset's English stands on a page in another language: JMdict's senses, Tatoeba's translations, a word list's glosses. */
const DATASET_ENGLISH_CLASSES = ['sense-list', 'sentence-en', 'entry-list'];

/**
 * Latin words that stand as they are in another language's text: names (the JLPT and its levels,
 * the kanji books, the dataset, the app, the sources a credit line names, the licence). Anything
 * else in Latin letters on a Chinese page is English, and must be marked so.
 */
const LATIN_NAMES = /\b(?:JLPT|N[1-5]|KKLC|RTK|CC BY-SA|gokan-dataset|Gokan SRS|Gokan|JMdict|Tatoeba)\b/g;

/**
 * English read as Chinese: a text run with Latin letters (names aside, LATIN_NAMES) and no Japanese
 * or Chinese character whose nearest lang is Chinese (zh*), where a screen reader would read
 * English with a Chinese voice. Over the whole body: the dataset's English (marked lang="en") and
 * any chrome left untranslated. Prerender and the server fail on any page it finds one in.
 */
export function englishWithoutLang(html: string): string[] {
    const found: string[] = [];
    walkBody(html, {
        text: (text, at) => {
            if (JAPANESE_TEXT.test(text) || !/[A-Za-z]/.test(text.replace(LATIN_NAMES, ''))) return;
            if (at.lang.toLowerCase().startsWith('zh')) found.push(text.trim());
        },
    });
    return found;
}

/** The attributes whose values a reader is told: an accessible name, a field's hint. */
const READ_ATTRIBUTES = /\s(?:aria-label|placeholder|title)="([^"]*)"/g;

/**
 * English's chrome on a page in another language: a text run, or an accessible name or a field's
 * hint, that is one of `englishStrings` (English's catalog, catalogStrings, less what the page's
 * own catalog shares with it), wherever it stands, lang="en" or not, but in the dataset's English
 * (DATASET_ENGLISH_CLASSES, where a gloss may read like a label). Prerender and the server fail on
 * any Chinese page it finds one on.
 */
export function englishChromeOn(html: string, englishStrings: readonly string[]): string[] {
    const english = new Set(englishStrings);
    const found: string[] = [];
    walkBody(html, {
        text: (text, at) => {
            if (english.has(text.trim()) && !DATASET_ENGLISH_CLASSES.some(className => at.within(className))) found.push(text.trim());
        },
        element: whole => {
            for (const [, value] of whole.matchAll(READ_ATTRIBUTES)) if (english.has(value.trim())) found.push(value.trim());
        },
    });
    return found;
}

/**
 * Where the dataset's Japanese stands on a word page, which may read like a Chinese label (活用 is
 * both a Japanese word and a Chinese section heading): sentences, word lists, kanji tiles, the
 * Forms table's forms, the spellings a sense applies to.
 */
const DATASET_JAPANESE_CLASSES = ['sentence-jp', 'entry-list', 'kanji-tiles', 'forms', 'sense-applies'];

/**
 * A page's own words outside its language: a text run holding one of `ownStrings` (the page's
 * catalog, its strings with a Chinese character, two or more long) whose nearest lang is not
 * Chinese, as when a label is written inside a lang="ja" reading line. A run whose own element is
 * lang="ja" (a headword, a breadcrumb's word) and the dataset's Japanese (DATASET_JAPANESE_CLASSES)
 * are Japanese however they read. Prerender and the server fail on any Chinese page it finds one on.
 */
export function chineseWithoutLang(html: string, ownStrings: readonly string[]): string[] {
    const own = ownStrings.filter(text => text.length >= 2 && HAN.test(text));
    const found: string[] = [];
    walkBody(html, {
        text: (text, at) => {
            if (at.lang.toLowerCase().startsWith('zh') || at.ownLang === 'ja' || DATASET_JAPANESE_CLASSES.some(className => at.within(className))) return;
            if (own.some(chrome => text.includes(chrome))) found.push(text.trim());
        },
    });
    return found;
}

/**
 * A link on a page in another language that leaves its section unmarked: an `<a>` whose href is not
 * under `sectionRoot` ("/dictionary/zh-hans/") and that carries no hreflang. The switcher and a
 * link to a page served in English only carry hreflang="en" (lib/localeLinks.ts, linkLang), and an
 * in-page anchor stays on the page. Prerender and the server fail on any Chinese page it finds one on.
 */
export function linksLeavingSection(html: string, sectionRoot: string): string[] {
    const found: string[] = [];
    walkBody(html, {
        element: whole => {
            if (!/^<a\s/i.test(whole)) return;
            const href = /\shref="([^"]*)"/.exec(whole)?.[1];
            if (href === undefined || href.startsWith('#') || href.startsWith(sectionRoot) || /\shreflang="/.test(whole)) return;
            found.push(whole);
        },
    });
    return found;
}

export function renderDocument(options: DocumentShellOptions): string {
    const canonical = absoluteUrl(options.canonicalPath);
    const title = escapeHtml(options.title);
    const description = escapeHtml(options.description);

    return `<!doctype html>
<html lang="${options.lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<title>${title}</title>
<meta name="description" content="${description}" />
${options.noindex ? '<meta name="robots" content="noindex" />\n' : ''}<link rel="canonical" href="${canonical}" />
${(options.alternates ?? []).map(alternate => `<link rel="alternate" hreflang="${alternate.hreflang}" href="${absoluteUrl(alternate.path)}" />\n`).join('')}<link rel="icon" type="image/svg+xml" href="${faviconPath()}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary" />
<link rel="stylesheet" href="${options.stylesheetHref}" />
${options.pageStylesheetHref ? `<link rel="stylesheet" href="${options.pageStylesheetHref}" />\n` : ''}${options.scriptHref ? `<script type="module" src="${options.scriptHref}"></script>\n` : ''}${options.extraScriptHref ? `<script type="module" src="${options.extraScriptHref}"></script>\n` : ''}${options.structuredData ? `<script type="application/ld+json">${JSON.stringify(options.structuredData)}</script>\n` : ''}${analyticsScriptTag(options.analyticsWebsiteId)}</head>
<body>
${stripHydrationMarkers(options.bodyHtml)}
</body>
</html>
`;
}
