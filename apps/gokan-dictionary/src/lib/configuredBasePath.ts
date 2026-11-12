// The path prefix the site is served under, from the build's VITE_BASE_PATH: one rule for the
// links (site.ts, which reads the variable through import.meta.env) and for SvelteKit's routes
// (vite.config.ts, which reads it from process.env and cannot load a module that touches
// import.meta.env). Both give this function what they read, so pages are rendered under the path
// they are served under.

import { DICTIONARY_BASE_PATH } from '@gokan/dataset-schema';

/**
 * A leading and no trailing slash ("/dictionary"), or "" when served from the root of its own
 * origin. An unset variable is the shared host's prefix.
 */
export function configuredBasePath(configured: string | undefined): '' | `/${string}` {
    const raw = configured ?? DICTIONARY_BASE_PATH;
    if (!raw || raw === '/') return '';
    const trimmed = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    return trimmed === '' ? '' : `/${trimmed}`;
}