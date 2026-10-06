// Pure projection from a full Vocabulary down to the lightweight VocabSummary shape used for
// cross-page linking (kanji breakdown chips, a word's components/parents, a kanji page's
// vocab list). Separated from scripts/prerender.ts so it's unit-testable without the Bun
// svelte-loader/dataset-fs machinery that script needs.

import type { Vocabulary } from '@gokan/dataset-schema';
import type { VocabSummary } from './types';

export function vocabSummaryFrom(vocab: Vocabulary): VocabSummary {
    return {
        id: vocab.id,
        kanji: vocab.writtenForm.kanji,
        reading: vocab.reading.primary,
        gloss: vocab.senses[0]?.glosses[0],
    };
}
