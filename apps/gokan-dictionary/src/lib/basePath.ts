// A public URL's path without the site's base path: what the server routes on (hooks.ts) and reads
// a locale off (hooks.server.ts). Its own module, not urls.ts: urls.ts is in the search script's
// bundle, and any change to what that bundle imports renames the script on every page.

import { BASE_PATH } from './site';

/** `pathname` without `base` (/dictionary/vocab/1/ is /vocab/1/, /dictionary is /); a path outside it is returned as it is. */
export function withoutBasePath(pathname: string, base: string = BASE_PATH): string {
    if (base === '') return pathname;
    if (pathname === base) return '/';
    return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}
