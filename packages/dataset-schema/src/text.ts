// The dataset's text layer: what one source says about one entity, in one language (the dataset's
// docs/MULTILINGUAL.md, "The model"), for a reader of a language other than English (the
// dictionary's Chinese section, #170). The dataset's own model, acceptance rule and accessors,
// re-exported rather than copied so there is one of each: which text a reader is shown is decided
// by `isShown` alone. Imports nothing from `node:` (text.test.ts follows every value import), so it
// runs wherever the published dataset is read.
/* eslint-disable no-restricted-imports -- the dataset's own text model, acceptance rule and accessors, reached at the path both apps already resolve the submodule at, re-exported so there is one implementation */
export type {
    Definition, DefinitionSense, DerivedValue, EntityText, Equivalent, LanguageTag, Rendering, SourceId, SourceRef, TextFile, TextStatus, Translation, Value,
} from '../../../apps/gokan-srs/dataset/src/models/text.model';
export type { CompiledEntitiesIndex as TextEntitiesIndex } from '../../../apps/gokan-srs/dataset/src/models/compiled.model';
export { isShown } from '../../../apps/gokan-srs/dataset/src/text/acceptance';
export { definitionsOf, equivalentsOf, translationRenderingsOf, translationsOf, valueText } from '../../../apps/gokan-srs/dataset/src/text/renderings';
/* eslint-enable no-restricted-imports */
