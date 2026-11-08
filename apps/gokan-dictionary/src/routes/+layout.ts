import { localeOfSegment } from '$lib/locale';
import type { LayoutLoad } from './$types';

// Every page is static HTML with no Svelte runtime (the build checks it): rendered on the
// server only, never hydrated. Each written as <path>/index.html.
export const csr = false;
export const prerender = true;
export const trailingSlash = 'always';

/** The locale every page is rendered in, from its optional locale segment: none is English. */
export const load: LayoutLoad = ({ params }) => ({ locale: localeOfSegment(params.locale) });
