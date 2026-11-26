import { SERVED_LOCALES } from '#lib/locale.ts';
import { buildSitemapIndexXml, sitemapIndexPaths } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

/** The sitemap index: each served locale's sitemap (routes/sitemap-[lang].xml) and the romaji pages', each under the 50,000-URL limit. */
export const GET: RequestHandler = () => new Response(buildSitemapIndexXml(sitemapIndexPaths(SERVED_LOCALES)), { headers: { 'content-type': 'application/xml' } });
