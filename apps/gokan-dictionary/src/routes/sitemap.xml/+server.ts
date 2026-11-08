import { sitemapPaths } from '$lib/server/dictionary';
import { buildSitemapXml } from '$lib/sitemap';
import type { RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

export const GET: RequestHandler = async () => new Response(buildSitemapXml(await sitemapPaths()), { headers: { 'content-type': 'application/xml' } });
