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
    // #170 adds 'zh-hans' here when the dictionary's Chinese section reads it.
    dictionary: ['en'],
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
