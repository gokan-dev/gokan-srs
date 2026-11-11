import { localeOfPath, localeOfSegment } from '$lib/locale';
import type { LayoutLoad } from './$types';

// Every page is static HTML with no Svelte runtime (the build checks it): rendered on the
// server only, never hydrated. Each written as <path>/index.html.
export const csr = false;
export const prerender = true;
export const trailingSlash = 'always';

/**
 * The locale every page is rendered in, from its optional locale segment: none is English. The
 * error page of a path no route matched has no params, so its locale is read off the path, by the
 * same rule handleError gives its document (hooks.server.ts): a Chinese 404 in Chinese chrome.
 */
export const load: LayoutLoad = ({ params, url }) => ({ locale: params.locale === undefined ? localeOfPath(url.pathname) : localeOfSegment(params.locale) });
