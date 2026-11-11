import { error } from '@sveltejs/kit';
import { entriesOf, searchIndexFile } from '$lib/server/dictionary';
import { localeOfSegment } from '$lib/locale';
import { isSearchIndexPart, SEARCH_INDEX_PARTS } from '$lib/searchIndex';
import type { EntryGenerator, RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

/** Both files in every served locale: English's at /data/, another's under its segment (/data/zh-hans/). */
export const entries: EntryGenerator = () => entriesOf(() => Promise.resolve(SEARCH_INDEX_PARTS.map(part => ({ part }))));

export const GET: RequestHandler = async ({ params }) => {
    // The matcher has checked it; narrowed here, as a route's params are strings.
    if (!isSearchIndexPart(params.part)) error(404);
    return Response.json(await searchIndexFile(params.part, localeOfSegment(params.locale)));
};
