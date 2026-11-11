import { error } from '@sveltejs/kit';
import { SERVED_LOCALES, servedLocaleNamed } from '$lib/locale';
import { sitemapPaths } from '$lib/server/dictionary';
import { buildSitemapXml } from '$lib/sitemap';
import type { EntryGenerator, RequestHandler } from './$types';

// An endpoint does not inherit the layout's page options.
export const prerender = true;

/** One sitemap per served locale, English's included: sitemap-en.xml, sitemap-zh-hans.xml (lib/sitemap.ts). */
export const entries: EntryGenerator = () => SERVED_LOCALES.map(locale => ({ lang: locale }));

export const GET: RequestHandler = async ({ params }) => {
    // The matcher has checked it; narrowed here, as a route's params are strings.
    const locale = servedLocaleNamed(params.lang);
    if (locale === undefined) error(404);
    return new Response(buildSitemapXml(await sitemapPaths(locale)), { headers: { 'content-type': 'application/xml' } });
};
