// The compiled dataset's English view, for code that reads the dataset from disk (gokan-srs's
// sync-dataset step, gokan-dictionary's prerender). The dataset keeps each file's explanation
// text apart from its core, per language (the dataset's docs/MULTILINGUAL.md); this gives back
// every file in the English shape both apps were written for, so their code and the types in
// this package are unchanged. It is the dataset's own projection, the one its check:legacy
// proves equal to the files before the text layer, re-exported rather than copied so there is
// one implementation. Node only: never import it from code that ships to a browser.
// eslint-disable-next-line no-restricted-imports -- the dataset's own projection, reached at the path both apps already resolve the submodule at, re-exported so there is one implementation
export { englishView, type EnglishView } from '../../../apps/gokan-srs/dataset/src/layout/english';
