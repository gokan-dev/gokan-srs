// One compiled file in its English shape, from inputs its reader has already fetched: the file's
// core, its English text under text/en/, and the shared files it declares. The dataset's own
// projection (its src/layout/englishFile.ts, gokan-dataset#55), re-exported rather than copied so
// there is one implementation; it imports nothing from `node:`, so it runs in a browser. gokan-srs
// reads the published dataset through it, in services/http.ts only (enforced by the conventions
// check); code that reads the dataset from disk uses `@gokan/dataset-schema/english`, built on it.
// eslint-disable-next-line no-restricted-imports -- the dataset's own projection, reached at the path both apps already resolve the submodule at, re-exported so there is one implementation
export { englishFile, englishInputs, type EnglishInputs, type EnglishInputValues } from '../../../apps/gokan-srs/dataset/src/layout/englishFile';
