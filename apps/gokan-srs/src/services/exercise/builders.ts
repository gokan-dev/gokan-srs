// src/services/exercise/builders.ts
//
// One builder per exercise kind. A builder decides what the exercise asks (its
// slots) and what decides a near-synonym (its cue); grading, feedback and SRS
// effects then come from the shared engine, never from the builder.
import type { Vocabulary } from '@gokan/dataset-schema';
import { blankSurfaceOf } from '../../utils/productionCloze.utils';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import { productionCueOf } from '../../utils/synonymContext.utils';
import { meaningSlot, readingSlot, synonymsOf, wordSlot } from './slots';
import type { Occurrence } from './slots';
import type { Exercise } from './types';

export function readingExercise(vocab: Vocabulary): Exercise {
    return { kind: 'reading', slots: [readingSlot(vocab)], cue: {} };
}

export function meaningExercise(vocab: Vocabulary): Exercise {
    return { kind: 'meaning', slots: [meaningSlot(vocab.senses.flatMap(s => s.glosses))], cue: {} };
}

/** The cloze blank as it sits in its sentence (食べたら / たべたら). */
function clozeOccurrence(vocab: Vocabulary, cloze: ProductionCloze): Occurrence {
    const surface = blankSurfaceOf(cloze);
    const dictionary = [vocab.writtenForm.kanji, ...vocab.writtenForm.alternatives, vocab.reading.primary, ...vocab.reading.alternatives];
    return { surface, reading: cloze.blankReading, inflected: !dictionary.includes(surface) };
}

/**
 * The production card: the sentence cloze when a usable sentence was found, the
 * gloss prompt otherwise. Both test whether the learner can produce the word, not
 * its conjugation (issue #95), so any form of it is correct, and both check a miss
 * against the word's near-synonyms in the light of the text the card shows.
 */
export function productionExercise(vocab: Vocabulary, cloze: ProductionCloze | null): Exercise {
    return {
        kind: cloze ? 'production-cloze' : 'production',
        slots: [wordSlot(vocab, {
            vocabId: vocab.id,
            occurrence: cloze ? clozeOccurrence(vocab, cloze) : undefined,
            otherForm: 'correct',
            role: 'core',
            synonyms: synonymsOf(vocab),
        })],
        cue: productionCueOf(vocab.senses, cloze),
    };
}
