// Site-wide constants shared by the prerender script, document shell, and page components.
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
export const BASE_PATH = (() => {
    const raw = import.meta.env.VITE_BASE_PATH ?? '/dictionary';
    if (!raw || raw === '/') return '';
    return trimTrailingSlash(raw.startsWith('/') ? raw : `/${raw}`);
})();

export const SITE_NAME = 'Gokan Dictionary';
