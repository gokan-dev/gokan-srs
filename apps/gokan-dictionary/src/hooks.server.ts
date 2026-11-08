// Every page's document: SvelteKit renders the page's body (app.html holds nothing else), and
// this wraps it in the document its load chose (renderDocument), with the built assets' hrefs,
// then refuses a page with Japanese text not marked lang="ja", on every page however it is
// rendered.

import type { Handle } from '@sveltejs/kit';
import { japaneseWithoutLang, renderDocument, stripHydrationMarkers } from '$lib/documentShell';
import { pageScriptHref, pageStylesheetHref, searchScriptHref, stylesheetHref } from '$lib/server/assets';
import { UMAMI_WEBSITE_ID } from '$lib/site';

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

    const { style, script, ...shell } = document;
    const html = renderDocument({
        ...shell,
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

export const handle: Handle = ({ event, resolve }) => resolve(event, {
    transformPageChunk: ({ html, done }) => {
        // The loads return no promises, so a page arrives in one chunk.
        if (!done) throw new Error(`[shell] ${event.url.pathname} was streamed; the document shell needs the whole page.`);
        return documentOf(html, event.locals, event.url.pathname);
    },
});
