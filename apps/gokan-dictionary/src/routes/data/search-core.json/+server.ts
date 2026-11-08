import { DEFAULT_LOCALE } from '$lib/locale';
import { pages } from '$lib/server/dictionary';
import type { RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
// English's: a locale's own search index (its glosses) comes with the locale (#170).
export const prerender = true;

export const GET: RequestHandler = async () => Response.json((await pages(DEFAULT_LOCALE).searchIndex()).core);
