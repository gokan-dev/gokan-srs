// Every page's document: SvelteKit renders the page's body (app.html holds nothing else), and
// this wraps it in the document its load chose (renderDocument), with the built assets' hrefs,
// then refuses a page with Japanese text not marked lang="ja", on every page however it is
// rendered. A page rendered on request also gets its Cache-Control here, by status.

import { building } from '$app/environment';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { renderedPageCacheControl } from '@gokan/deploy/deploy-manifest';
import { japaneseWithoutLang, renderDocument, stripHydrationMarkers } from '$lib/documentShell';
import { pageScriptHref, pageStylesheetHref, searchScriptHref, stylesheetHref } from '$lib/server/assets';
import { htmlLang, isLocaleSegment, localeOfSegment } from '$lib/locale';
import { errorDocument } from '$lib/server/pages';
import { BASE_PATH, UMAMI_WEBSITE_ID } from '$lib/site';

/** Where app.html puts the body: everything before it is SvelteKit's head, which must stay empty. */
const BODY_MARKER = '<!--gokan:body-->';

export function documentOf(rendered: string, locals: App.Locals, pathname: string): string {
    const { document } = locals;
    if (document === undefined) throw new Error(`[shell] ${pathname} was rendered without a document: its load must go through render() (lib/server/route.ts).`);
    const at = rendered.indexOf(BODY_MARKER);
    if (at < 0) throw new Error(`[shell] ${pathname}: app.html's body marker is missing.`);
    // SvelteKit writes a component's styles, preloads and <svelte:head> here. The pages use none;
    // one that did would lose them silently, so it fails instead.
    const head = rendered.slice(0, at).trim();
    if (head !== '') throw new Error(`[shell] ${pathname}: SvelteKit wrote ${head.slice(0, 200)} into the head, which the document shell would drop.`);

    const { locale, style, script, ...shell } = document;
    const html = renderDocument({
        ...shell,
        lang: htmlLang(locale),
        ...(style ? { pageStylesheetHref: pageStylesheetHref(style) } : {}),
        ...(script ? { extraScriptHref: pageScriptHref(script) } : {}),
        // Stripped before trimming: SvelteKit's root component leaves a space beside its markers.
        bodyHtml: stripHydrationMarkers(rendered.slice(at + BODY_MARKER.length)).trim(),
        stylesheetHref: stylesheetHref(),
        scriptHref: searchScriptHref(),
        analyticsWebsiteId: UMAMI_WEBSITE_ID,
    });
    const unmarked = japaneseWithoutLang(html);
    if (unmarked.length > 0) throw new Error(`[shell] ${shell.canonicalPath} has Japanese text not marked lang="ja", e.g. ${unmarked[0]}`);
    return html;
}

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event, {
        transformPageChunk: ({ html, done }) => {
            // The loads return no promises, so a page arrives in one chunk.
            if (!done) throw new Error(`[shell] ${event.url.pathname} was streamed; the document shell needs the whole page.`);
            return documentOf(html, event.locals, event.url.pathname);
        },
    });
    // A prerendered page's headers are the deploy's (cacheControlFor); this is for what the
    // server renders: kept at the edge, revalidated by the browser, an error never kept.
    if (!building) response.headers.set('cache-control', renderedPageCacheControl(response.status));
    return response;
};

/**
 * An error SvelteKit did not expect (a failed dataset read, a path no route matches): the error
 * page gets its document here. A page's own 404 (PageNotFound) already has one (render).
 */
export const handleError: HandleServerError = ({ event, status, message }) => {
    // A path no route matched has no params: its locale is read off the path, as a route would.
    const { pathname } = event.url;
    const segment = (pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname).split('/')[1] ?? '';
    event.locals.document ??= errorDocument(status, event.url.pathname, localeOfSegment(isLocaleSegment(segment) ? segment : undefined));
    if (status >= 500) console.error(`[dictionary] ${event.url.pathname}: ${message}`);
    return { message };
};
