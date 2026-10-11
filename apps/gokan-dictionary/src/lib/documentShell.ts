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

/**
 * Opening tags of elements that carry the `jp` class but not lang="ja". Japanese text must be
 * marked as Japanese, or screen readers read it with an English voice and some devices draw it
 * with Chinese glyph shapes; prerender fails on any page this finds anything in.
 */
export function japaneseWithoutLang(html: string): string[] {
    const found: string[] = [];
    for (const tag of html.matchAll(/<[a-z][a-z0-9]*\b[^>]*>/g)) {
        const classes = /\sclass="([^"]*)"/.exec(tag[0])?.[1].split(/\s+/) ?? [];
        if (classes.includes('jp') && !/\slang="ja"/.test(tag[0])) found.push(tag[0]);
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
