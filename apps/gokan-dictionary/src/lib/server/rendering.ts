// How the server renders: which pages are prerendered, and where a page rendered on request reads
// the dataset. Constants the build bakes in (vite.config.ts), and the origin the server is told at
// run time.

import { DATASET_PREFIX } from '@gokan/deploy/published-dataset';
import { searchIndexPaths } from '../urls';

declare const __DATASET_VERSION__: string;
declare const __ENTITY_PAGES__: 'prerendered' | 'on-request';

/**
 * Whether the word, kanji and grammar point pages are prerendered (every page static, the deploy
 * until #209) or rendered on request. The list pages are prerendered either way.
 */
export const ENTITY_PAGES_PRERENDERED = __ENTITY_PAGES__ === 'prerendered';

/** Where a page rendered on request reads: the published dataset and the site's search index, on `origin`. */
export function publishedSourceUrls(origin: string): { datasetUrl: (path: string) => string; searchIndexUrls: { core: string; full: string } } {
    const base = origin.replace(/\/$/, '');
    const { core, full } = searchIndexPaths();
    return {
        datasetUrl: path => `${base}${DATASET_PREFIX}${path}?v=${__DATASET_VERSION__}`,
        searchIndexUrls: { core: `${base}${core}`, full: `${base}${full}` },
    };
}
