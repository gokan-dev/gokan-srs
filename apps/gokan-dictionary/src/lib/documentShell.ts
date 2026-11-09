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
 * Whether a run in Japanese script only may stand in an element of `lang`: in Japanese, always;
 * in Chinese, when it has Han characters (Chinese itself, or Chinese prose quoting a Japanese
 * word, as English prose does), never kana alone; in any other language, never.
 */
function readsAs(lang: string, text: string): boolean {
    if (lang === 'ja') return true;
    return lang.toLowerCase().startsWith('zh') && HAN.test(text);
}

/**
 * Japanese in a page's body that is not marked as Japanese: an element with the `jp` class but
 * no lang="ja", or a text run in Japanese only (no Latin letters, so not an English sentence
 * quoting a word) whose nearest lang is not "ja" (on a Chinese page, see readsAs). Unmarked,
 * screen readers read it with an English voice and some devices draw it with Chinese glyph
 * shapes; prerender fails on any page this finds anything in. Script contents are skipped
 * (JSON-LD names the word). The nearest lang of the body is the document's <html lang>.
 */
export function japaneseWithoutLang(html: string): string[] {
    const bodyStart = html.indexOf('<body');
    const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
    const documentLang = /<html\b[^>]*\slang="([^"]*)"/.exec(html)?.[1] ?? 'en';
    const found: string[] = [];
    const stack: { tag: string; lang: string | null }[] = [];
    const langHere = () => [...stack].reverse().find(entry => entry.lang !== null)?.lang ?? documentLang;

    for (const token of body.matchAll(/<script\b[\s\S]*?<\/script>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)) {
        const [whole, closing, rawTag, attributes, text] = token;
        if (text !== undefined) {
            if (isJapaneseOnly(text) && !readsAs(langHere(), text)) found.push(text.trim());
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
        if (classes.includes('jp') && lang !== 'ja') found.push(whole);
        if (!VOID_ELEMENTS.has(tag) && !whole.endsWith('/>')) stack.push({ tag, lang });
    }
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
<link rel="icon" type="image/svg+xml" href="${faviconPath()}" />
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
