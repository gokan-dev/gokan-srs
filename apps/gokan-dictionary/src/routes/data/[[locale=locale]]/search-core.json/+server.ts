import { entriesOf, searchIndexFile } from '$lib/server/dictionary';
import { localeOfSegment } from '$lib/locale';
import type { EntryGenerator, RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

/** One file per served locale: English's at /data/, another's under its segment (/data/zh-hans/). */
export const entries: EntryGenerator = () => entriesOf(() => Promise.resolve([{}]));

export const GET: RequestHandler = async ({ params }) => Response.json(await searchIndexFile('core', localeOfSegment(params.locale)));
