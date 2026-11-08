import { searchIndexFile } from '$lib/server/dictionary';
import type { RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

export const GET: RequestHandler = async () => Response.json(await searchIndexFile('core'));
