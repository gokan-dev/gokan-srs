// Site-wide constants shared by the server (lib/server/), document shell, and page components.
//
// The dictionary is deployed as a SUBFOLDER of the gokan-srs site (gokan-srs.com/dictionary),
// not as its own subdomain: with no established domain authority yet, consolidating every
// link and ranking signal onto one hostname is worth more than the operational tidiness of a
// separate host. That decision is why BASE_PATH exists at all - set it to '' and this app
// builds for a bare origin instead, which is the only change a move to a subdomain would need.
//
// Both values are read from the environment so staging and production build from identical
// source: the deploy workflow sets VITE_SITE_ORIGIN per environment (see
// .github/workflows/deploy.yml). `import.meta.env` deliberately, not `process.env` - Vite
// statically replaces VITE_-prefixed reads in the client bundle (src/client/search.ts reaches
// this module through urls.ts), while Bun resolves the same expression at prerender time, so
// one declaration serves both without a `typeof process` guard.

import { configuredBasePath } from './configuredBasePath';

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** Scheme + host only, no path and no trailing slash, e.g. "https://gokan-srs.com". */
export const SITE_ORIGIN = trimTrailingSlash(
    import.meta.env.VITE_SITE_ORIGIN || 'https://gokan-srs.com',
);

/**
 * Path prefix every URL on this site sits under, with a leading and no trailing slash
 * (e.g. "/dictionary"), or "" when served from the root of its own origin.
 *
 * This affects generated URLs only, never the on-disk layout under dist/: the deploy step
 * syncs dist/ to the `dictionary/` key prefix in the S3 bucket, so the prefix is applied by
 * the upload rather than baked into the directory names.
 */
export const BASE_PATH = configuredBasePath(import.meta.env.VITE_BASE_PATH);

export const SITE_NAME = 'Gokan Dictionary';

/** Set only by the production deploy, so no other build counts visits (see @gokan/analytics). */
export const UMAMI_WEBSITE_ID: string | undefined = import.meta.env.VITE_UMAMI_WEBSITE_ID;

/**
 * The locales the dictionary is built and served in, space-separated ("en", "en zh-hans"): set
 * per environment by the deploy (production English alone, staging with Chinese, #170), read by
 * lib/locale.ts. Unset is English alone.
 */
export const DICTIONARY_LOCALES: string | undefined = import.meta.env.VITE_DICTIONARY_LOCALES;
