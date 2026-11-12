import { SERVED_LOCALES } from '#lib/locale.ts';
import { buildSitemapIndexXml, localeSitemapPath } from '#lib/sitemap.ts';
import type { RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

/** The sitemap index: each served locale's sitemap (routes/sitemap-[lang].xml), each under the 50,000-URL limit. */
export const GET: RequestHandler = () => new Response(buildSitemapIndexXml(SERVED_LOCALES.map(localeSitemapPath)), { headers: { 'content-type': 'application/xml' } });
