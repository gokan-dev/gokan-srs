import { error } from '@sveltejs/kit';
import { buildRobotsTxt, shouldEmitRobotsTxt } from '$lib/sitemap';
import type { RequestHandler } from './$types';

// Subfolder mode: gokan-srs's public/robots.txt is the authoritative one for this host and
// already carries our Sitemap: line (shouldEmitRobotsTxt), so this file is not written.
export const prerender = shouldEmitRobotsTxt();

export const GET: RequestHandler = () => {
    if (!shouldEmitRobotsTxt()) error(404, 'robots.txt belongs to the host in a subfolder deploy');
    return new Response(buildRobotsTxt(), { headers: { 'content-type': 'text/plain' } });
};
