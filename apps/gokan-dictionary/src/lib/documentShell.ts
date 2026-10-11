// Pure HTML-document builder. Svelte's server render() only produces a <body>-shaped
// fragment (see prototype notes in scripts/prerender.ts) - this wraps that fragment with the
// <head> (SEO meta, canonical link, JSON-LD, asset links) every static page needs. Kept as
// plain string templating rather than a Svelte component: a document shell (<html>/<head>)
// isn't itself a piece of UI, and templating it directly avoids a whole extra SSR call per
// page for something that's just string concatenation.

import { absoluteUrl, faviconPath } from './urls';

export interface DocumentShellOptions {
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

/**
 * Japanese in a page's body that is not marked as Japanese: an element with the `jp` class but
 * no lang="ja", or a text run in Japanese only (no Latin letters, so not an English sentence
 * quoting a word) whose nearest lang is not "ja". Unmarked, screen readers read it with an
 * English voice and some devices draw it with Chinese glyph shapes; prerender fails on any page
 * this finds anything in. Script contents are skipped (JSON-LD names the word).
 */
export function japaneseWithoutLang(html: string): string[] {
    const bodyStart = html.indexOf('<body');
    const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
    const found: string[] = [];
    const stack: { tag: string; lang: string | null }[] = [];
    const langHere = () => [...stack].reverse().find(entry => entry.lang !== null)?.lang ?? 'en';

    for (const token of body.matchAll(/<script\b[\s\S]*?<\/script>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)) {
        const [whole, closing, rawTag, attributes, text] = token;
        if (text !== undefined) {
            if (isJapaneseOnly(text) && langHere() !== 'ja') found.push(text.trim());
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
<html lang="en">
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
${options.pageStylesheetHref ? `<link rel="stylesheet" href="${options.pageStylesheetHref}" />\n` : ''}${options.scriptHref ? `<script type="module" src="${options.scriptHref}"></script>\n` : ''}${options.extraScriptHref ? `<script type="module" src="${options.extraScriptHref}"></script>\n` : ''}${options.structuredData ? `<script type="application/ld+json">${JSON.stringify(options.structuredData)}</script>\n` : ''}</head>
<body>
${stripHydrationMarkers(options.bodyHtml)}
</body>
</html>
`;
}
