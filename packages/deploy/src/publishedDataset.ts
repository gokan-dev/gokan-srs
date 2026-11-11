// What of the compiled dataset is published, under /dataset/ (the `data` site in deployManifest.ts,
// issue #203): the dataset as it is, core files plus `text/<lang>/`, but only the languages an app
// reads. A language is uploaded once an app reads it, never ahead (the lazy rule, #201): adding
// one to an app's list below is what publishes it, and the deploy's manifest then uploads it in
// full once and only its changes after. Both apps read the same published files; neither deploys
// a merged or derived copy.

/** The languages each app reads from the published dataset. */
export const APP_LANGUAGES = {
    // gokan-srs stays English (#201, standing decisions).
    srs: ['en'],
    // Its Chinese section (#170), served in production since 1.62.0 (VITE_DICTIONARY_LOCALES): published to
    // both environments' buckets by the one data deploy, since a site serves only what it builds.
    dictionary: ['en', 'zh-hans'],
} as const satisfies Record<string, readonly string[]>;

/** Every language some app reads: what is published. */
export const PUBLISHED_LANGUAGES: ReadonlySet<string> = new Set(Object.values(APP_LANGUAGES).flat());

/**
 * Whether a file of compiled/ (a POSIX path relative to it) is published. Everything is, except a
 * text file of a language no app reads, and the build's logs (`*.log`, a record of the build run,
 * not data).
 */
export function isPublishedDatasetFile(file: string): boolean {
    if (file.endsWith('.log')) return false;
    const text = /^text\/([^/]+)\//.exec(file);
    return text === null || PUBLISHED_LANGUAGES.has(text[1]);
}

/** The URL prefix the published dataset is served under. */
export const DATASET_PREFIX = '/dataset/';

/**
 * The file of compiled/ a request for `pathname` (decoded, without its query) reads, as the
 * published dataset answers it, or null when it is not a published file. What a local server
 * stands in for: gokan-srs's dev and preview servers, and the servers the browser checks run.
 */
export function publishedDatasetFile(pathname: string): string | null {
    if (!pathname.startsWith(DATASET_PREFIX)) return null;
    const file = pathname.slice(DATASET_PREFIX.length);
    if (file.split('/').some(part => part === '' || part === '.' || part === '..')) return null;
    return isPublishedDatasetFile(file) ? file : null;
}
