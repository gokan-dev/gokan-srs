/**
 * One shipped change, as the What's new page lists it. The committed list is
 * `release/changelog.ts`; the build serves it at `/changelog.json` (vite.config.ts).
 */
export interface ChangelogEntry {
    /** `1.43.0`, without the `v`. The newest entry's is the app's version. */
    version: string;
    /** The day it shipped, `YYYY-MM-DD`. */
    date: string;
    /** The change in one plain sentence, written for a learner. */
    summary: string;
    /** The GitHub issue it closed, or its pull request when there was no issue. */
    issue?: number;
}

/** What the deploy serves at `/version.json`: the live build, for an open tab to compare against. */
export interface LiveVersion {
    version: string;
    /** The dataset submodule's commit, as `__DATASET_VERSION__`. */
    dataset: string;
}
