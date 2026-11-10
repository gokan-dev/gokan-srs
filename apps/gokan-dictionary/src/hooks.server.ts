// Every page's document: SvelteKit renders the page's body (app.html holds nothing else), and
// this wraps it in the document its load chose (renderDocument), with the built assets' hrefs and
// its alternates in the other locales, then refuses a page with Japanese text not marked
// lang="ja", and a page in another language with English unmarked, English's chrome, its own
// words outside its lang, or a link leaving its section unmarked, on every page however it is
// rendered. A page rendered on request also gets its Cache-Control here, by status.

import { building } from '$app/environment';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { renderedPageCacheControl } from '@gokan/deploy/deploy-manifest';
import { chineseWithoutLang, englishChromeOn, englishWithoutLang, japaneseWithoutLang, linksLeavingSection, renderDocument, stripHydrationMarkers } from '$lib/documentShell';
import { localeStylesheetHref, pageScriptHref, pageStylesheetHref, searchScriptHref, stylesheetHref } from '$lib/server/assets';
import { DEFAULT_LOCALE, htmlLang, isLocaleSegment, localeOfSegment, type ServedLocale } from '$lib/locale';
import { catalogStrings, messagesFor } from '$lib/messages';
import { localeUrls } from '$lib/urls';
import { errorDocument } from '$lib/server/pages';
import { withoutBasePath } from '$lib/basePath';
import { UMAMI_WEBSITE_ID } from '$lib/site';

/** Where app.html puts the body: everything before it is SvelteKit's head, which must stay empty. */
const BODY_MARKER = '<!--gokan:body-->';

const ENGLISH_STRINGS = catalogStrings(messagesFor(DEFAULT_LOCALE));

/** What a page in a locale other than English must not carry, by what each check finds. */
function localeProblems(html: string, locale: ServedLocale): string[] {
    if (locale === DEFAULT_LOCALE) return [];
    const own = catalogStrings(messagesFor(locale));
    const shared = new Set(own);
    const english = englishWithoutLang(html).map(text => `English text read as Chinese, not marked lang="en": ${text}`);
    const chrome = englishChromeOn(html, ENGLISH_STRINGS.filter(text => !shared.has(text))).map(text => `English's chrome, not its own catalog's: ${text}`);
    const outside = chineseWithoutLang(html, own).map(text => `its own words outside lang="${htmlLang(locale)}": ${text}`);
    const leaving = linksLeavingSection(html, localeUrls(locale).homePath()).map(link => `a link leaving its section without hreflang: ${link}`);
    return [...english, ...chrome, ...outside, ...leaving];
}

export function documentOf(rendered: string, locals: App.Locals, pathname: string): string {
    const { document } = locals;
    if (document === undefined) throw new Error(`[shell] ${pathname} was rendered without a document: its load must go through render() (lib/server/route.ts).`);
    const at = rendered.indexOf(BODY_MARKER);
    if (at < 0) throw new Error(`[shell] ${pathname}: app.html's body marker is missing.`);
    // SvelteKit writes a component's styles, preloads and <svelte:head> here. The pages use none;
    // one that did would lose them silently, so it fails instead.
    const head = rendered.slice(0, at).trim();
    if (head !== '') throw new Error(`[shell] ${pathname}: SvelteKit wrote ${head.slice(0, 200)} into the head, which the document shell would drop.`);

    const { locale, style, script, key: _key, alternates = [], ...shell } = document;
    const english = alternates.find(alternate => alternate.locale === DEFAULT_LOCALE);
    const html = renderDocument({
        ...shell,
        lang: htmlLang(locale),
        // x-default: English's page, for a reader in any other language.
        ...(alternates.length > 0 ? { alternates: [...alternates.map(alternate => ({ hreflang: htmlLang(alternate.locale), path: alternate.path })), ...(english ? [{ hreflang: 'x-default', path: english.path }] : [])] } : {}),
        ...(style ? { pageStylesheetHref: pageStylesheetHref(style) } : {}),
        ...(script ? { extraScriptHref: pageScriptHref(script) } : {}),
        // Stripped before trimming: SvelteKit's root component leaves a space beside its markers.
        bodyHtml: stripHydrationMarkers(rendered.slice(at + BODY_MARKER.length)).trim(),
        stylesheetHref: stylesheetHref(),
        ...(localeStylesheetHref(locale) ? { localeStylesheetHref: localeStylesheetHref(locale) } : {}),
        scriptHref: searchScriptHref(),
        analyticsWebsiteId: UMAMI_WEBSITE_ID,
    });
    const unmarked = japaneseWithoutLang(html);
    if (unmarked.length > 0) throw new Error(`[shell] ${shell.canonicalPath} has Japanese text not marked lang="ja", e.g. ${unmarked[0]}`);
    const problems = localeProblems(html, locale);
    if (problems.length > 0) throw new Error(`[shell] ${shell.canonicalPath} has ${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}`);
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
    const segment = withoutBasePath(pathname).split('/')[1] ?? '';
    event.locals.document ??= errorDocument(status, event.url.pathname, localeOfSegment(isLocaleSegment(segment) ? segment : undefined));
    if (status >= 500) console.error(`[dictionary] ${event.url.pathname}: ${message}`);
    return { message };
};
