import { romajiSitemapPaths } from '#lib/server/dictionary.ts';
import { buildSitemapXml } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

/** The romaji pages (#278), in a sitemap of their own so Search Console reports them apart (lib/sitemap.ts). */
export const GET: RequestHandler = async () => new Response(buildSitemapXml(await romajiSitemapPaths()), { headers: { 'content-type': 'application/xml' } });
