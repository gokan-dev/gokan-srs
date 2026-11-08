// Behind CloudFront the server is asked for the site's public URLs, under BASE_PATH
// (/dictionary/vocab/123/); its routes are the paths the build writes pages at, without it
// (vocab/123/, deployed to the `dictionary/` prefix). The base path is dropped before routing, so
// the server answers what CloudFront forwards and the static layout stays as it is.

import type { Reroute } from '@sveltejs/kit';
import { BASE_PATH } from '$lib/site';

export const reroute: Reroute = ({ url }) => {
    if (BASE_PATH === '' || !(url.pathname === BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`))) return undefined;
    return url.pathname.slice(BASE_PATH.length) || '/';
};
