// The version every dataset request carries (`?v=`, gokan-srs's datasetUrl, the dictionary's
// server): the dataset submodule's pinned commit, so a new dataset is a new URL and no cache
// answers it from an older file. One definition, so both apps ask for the same URLs and share
// every cache on the way. Node only: a build reads it and bakes it in.

import { execFileSync } from 'node:child_process';

/** The submodule's path from the repo root, as this repo's tree records its commit. */
const DATASET_SUBMODULE = 'apps/gokan-srs/dataset';

/**
 * The pinned dataset commit, 12 hex digits, read from this repo's tree (`HEAD:<path>`) rather than
 * the submodule, so it works before the submodule is checked out. `cwd` is any directory inside the
 * repo.
 */
export function datasetVersion(cwd: string): string {
    return execFileSync('git', ['rev-parse', '--short=12', `HEAD:${DATASET_SUBMODULE}`], { cwd, encoding: 'utf8' }).trim();
}
