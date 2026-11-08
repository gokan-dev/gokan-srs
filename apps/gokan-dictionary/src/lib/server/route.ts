// The one way a route's load returns a page: its props go to the page component, its document to
// the server hook (hooks.server.ts) through `locals`, and a page that does not exist is a 404.

import { error } from '@sveltejs/kit';
import { PageNotFound, type Rendered } from './pages';

export async function render<Props>(locals: App.Locals, build: () => Rendered<Props> | Promise<Rendered<Props>>): Promise<{ props: Props }> {
    try {
        const { props, document } = await build();
        locals.document = document;
        return { props };
    } catch (cause) {
        if (cause instanceof PageNotFound) error(404, cause.message);
        throw cause;
    }
}
