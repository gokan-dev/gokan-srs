// The one way a route's load returns a page: built in the locale its path names, its props go to
// the page component, its document to the server hook (hooks.server.ts) through `locals`, with the
// page's counterparts in the other locales, and a page that does not exist is a 404 with the error
// page's document.

import { error } from '@sveltejs/kit';
import { localeOfSegment, type ServedLocale } from '../locale';
import { alternatesOf } from './dictionary';
import { errorDocument, PageNotFound, type Alternate, type Rendered } from './pages';

/**
 * What a route's load returns: its page's props, and the page in the other locales that have it
 * (the language switcher reads them, PageLayout.svelte).
 */
export async function render<Props>(
    event: { locals: App.Locals; url: URL; params: { locale?: string } },
    build: (locale: ServedLocale) => Rendered<Props> | Promise<Rendered<Props>>,
): Promise<{ props: Props; alternates: Alternate[] }> {
    const locale = localeOfSegment(event.params.locale);
    try {
        const { props, document } = await build(locale);
        const alternates = document.key ? await alternatesOf(document.key, locale) : [];
        event.locals.document = { ...document, alternates };
        return { props, alternates };
    } catch (cause) {
        if (cause instanceof PageNotFound) {
            event.locals.document = errorDocument(404, event.url.pathname, locale);
            error(404, cause.message);
        }
        throw cause;
    }
}
