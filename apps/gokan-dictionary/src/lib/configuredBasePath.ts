// The path prefix the site is served under, from the build's VITE_BASE_PATH: one rule for the
// links (site.ts, which reads the variable through import.meta.env) and for SvelteKit's routes
// (vite.config.ts, which reads it from process.env and cannot load a module that touches
// import.meta.env). Both give this function what they read, so pages are rendered under the path
// they are served under.

/**
 * The shared host's prefix, @gokan/dataset-schema's DICTIONARY_BASE_PATH (the test holds the two
 * equal). Written here because vite.config.ts loads this module under Node, which cannot load
 * that package's TypeScript.
 */
export const DEFAULT_BASE_PATH = '/dictionary';

/**
 * A leading and no trailing slash ("/dictionary"), or "" when served from the root of its own
 * origin. An unset variable is the shared host's prefix.
 */
export function configuredBasePath(configured: string | undefined): '' | `/${string}` {
    const raw = configured ?? DEFAULT_BASE_PATH;
    if (!raw || raw === '/') return '';
    const trimmed = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    return trimmed === '' ? '' : `/${trimmed}`;
}