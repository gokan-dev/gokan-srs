// src/services/exercise/builders.ts
//
// One builder per host. A builder decides what an exercise asks (its slots), what
// decides a near-synonym (its cue) and what its card shows; grading, feedback and
// SRS effects then come from the shared engine, never from the builder.
import { headwordOf } from '@gokan/dataset-schema';
import type { GrammarPoint, Sentence, Vocabulary } from '@gokan/dataset-schema';
import { grammarClozeSentence, productionClozeSentence } from '../../utils/clozeSentence.utils';
import { grammarExampleToSentence } from '../../utils/grammarSentence.utils';
import { blankSurfaceOf } from '../../utils/productionCloze.utils';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import type { QuizMode, QuizType } from '../../utils/srs.utils';
import { productionCueOf } from '../../utils/synonymContext.utils';
import type { GrammarBlankPlan } from '../../context/quiz/grammarReducer';
import { meaningSlot, readingSlot, synonymsOf, wordSlot } from './slots';
import type { Occurrence } from './slots';
import type { Exercise, HostItem } from './types';

/** The cloze blank as it sits in its sentence (食べたら / たべたら). */
function clozeOccurrence(vocab: Vocabulary, cloze: ProductionCloze): Occurrence {
    const surface = blankSurfaceOf(cloze);
    const dictionary = [vocab.writtenForm.kanji, ...vocab.writtenForm.alternatives, vocab.reading.primary, ...vocab.reading.alternatives];
    return { surface, reading: cloze.blankReading, inflected: !dictionary.includes(surface) };
}

/** What the vocab loader fetched for the card: the meaning card's context sentence, the production cloze's sentence. */
export interface VocabCardData {
    sentence: Sentence | null;
    cloze: ProductionCloze | null;
}

/**
 * The exercise for one direction of a word.
 * - reading: the readings only, since reading means sounding out the written form;
 * - meaning: every gloss, in context when a sentence was found;
 * - production: the sentence cloze when a usable sentence was found, the gloss
 *   prompt otherwise. Both test whether the learner can produce the word, not its
 *   conjugation (issue #95), so any form of it is correct, and both check a miss
 *   against the word's near-synonyms in the light of the text the card shows.
 */
export function vocabExercise(vocab: Vocabulary, item: { quizType: QuizType; quizMode: QuizMode }, { sentence, cloze }: VocabCardData): Exercise {
    const host: HostItem = { kind: 'vocab', vocabId: vocab.id, quizType: item.quizType, quizMode: item.quizMode };
    const label = headwordOf(vocab);
    switch (item.quizType) {
        case 'reading':
            return { kind: 'reading', host, label, slots: [readingSlot(vocab)], cue: {} };
        case 'meaning':
            return {
                kind: 'meaning', host, label, sentence, contextRequested: item.quizMode === 'context',
                slots: [meaningSlot(vocab.senses.flatMap(s => s.glosses))], cue: {},
            };
        case 'production': {
            const slot = wordSlot(vocab, {
                vocabId: vocab.id,
                occurrence: cloze ? clozeOccurrence(vocab, cloze) : undefined,
                otherForm: 'correct',
                role: 'core',
                synonyms: synonymsOf(vocab),
            });
            const cue = productionCueOf(vocab.senses, cloze);
            return cloze
                ? { kind: 'production-cloze', host, label, slots: [slot], cue, cloze, sentence: productionClozeSentence(cloze) }
                : { kind: 'production', host, label, slots: [slot], cue };
        }
    }
}

/**
 * A grammar card from its blank plan (computeBlankPlan): the conjugation drill,
 * the sentence cloze, or the study card when nothing in the point is blankable.
 * The plan's slots already say what each blank accepts and how it counts.
 */
export function grammarExercise(point: Pick<GrammarPoint, 'id' | 'title' | 'examples'>, plan: GrammarBlankPlan): Exercise {
    const host: HostItem = { kind: 'grammar', grammarId: point.id };
    const base = { host, label: point.title, slots: plan.slots };
    if (plan.conjugation) return { ...base, kind: 'conjugation', cue: {}, prompt: plan.conjugation };

    // The plan's own example, never point.examples[exampleIndex]: a rotated
    // realization or a mined sentence does not live in point.examples.
    const example = plan.example ?? point.examples[plan.exampleIndex];
    const id = `${point.id}:${plan.exampleIndex}`;
    if (plan.readOnly) return { ...base, kind: 'study', cue: {}, sentence: grammarExampleToSentence(example, id) };
    return {
        ...base,
        kind: 'grammar-cloze',
        cue: { sentence: example.en },
        sentence: grammarClozeSentence(example, plan.blankWordSpans, id),
        ...(plan.realization ? { realization: plan.realization } : {}),
    };
}
