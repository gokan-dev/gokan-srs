// The one way a route's load returns a page: its props go to the page component, its document to
// the server hook (hooks.server.ts) through `locals`, and a page that does not exist is a 404 with
// the error page's document.

import { error } from '@sveltejs/kit';
import { errorDocument, PageNotFound, type Rendered } from './pages';

export async function render<Props>(
    event: { locals: App.Locals; url: URL },
    build: () => Rendered<Props> | Promise<Rendered<Props>>,
): Promise<{ props: Props }> {
    try {
        const { props, document } = await build();
        event.locals.document = document;
        return { props };
    } catch (cause) {
        if (cause instanceof PageNotFound) {
            event.locals.document = errorDocument(404, event.url.pathname);
            error(404, cause.message);
        }
        throw cause;
    }
}
