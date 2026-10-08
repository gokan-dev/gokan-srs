// src/services/exercise/types.ts
//
// The exercise engine's vocabulary. Every quiz the app serves (reading, meaning,
// production, both clozes, the conjugation drill) is an Exercise: a prompt plus
// answer slots. What differs between exercises is data on the slots, never a
// separate grading path, so a rule added to the grader reaches every exercise.
import type { Sentence, SynonymRelation, Vocabulary } from '@gokan/dataset-schema';
import type { AnswerResult, Leniency } from '../../utils/answerMatching';
import type { ClozeSentence } from '../../utils/clozeSentence.utils';
import type { InflectableWord } from '../../utils/inflection.utils';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import type { QuizMode, QuizType } from '../../utils/srs.utils';
import type { ProductionCue, SynonymOutcome } from '../../utils/synonymContext.utils';
import type { GrammarBlankPlan, GrammarConjugationPrompt } from '../../context/quiz/grammarReducer';

type GrammarRealization = NonNullable<GrammarBlankPlan['realization']>;

/** Every exercise the app serves. A switch over it must name each one, so a new kind fails to compile until it is handled. */
export type ExerciseKind = 'reading' | 'meaning' | 'production' | 'production-cloze' | 'grammar-cloze' | 'conjugation' | 'study';

/** The item an exercise reviews: one direction of a word, or a grammar point. Its SRS entry is what a `review` effect moves. */
export type HostItem =
    | { kind: 'vocab'; vocabId: string; quizType: QuizType; quizMode: QuizMode }
    | { kind: 'grammar'; grammarId: string };

/**
 * What grading reads off a word: its forms, and `senses` for the part-of-speech
 * tags the inflection generator needs. A word without `senses` simply has no
 * inflections, and only its dictionary forms are accepted.
 */
export type WordForms = Pick<Vocabulary, 'reading' | 'writtenForm' | 'mergedVocabs' | 'usuallyKana'> & Partial<Pick<Vocabulary, 'senses'>>;

/** One near-synonym of a slot's word, graded like the word itself when the answer misses it. */
export interface SynonymCandidate {
    vocabId: string;
    relation: SynonymRelation;
    vocab: WordForms;
    /** See VocabSynonym.shared / curated. */
    shared?: string[];
    curated?: boolean;
}

/**
 * How another form of the slot's word grades (食べた for 食べて). Production tests
 * the word, so any form is `correct`; a sentence blank also tests the conjugation,
 * so it is a near miss; the conjugation drill tests nothing else, so it is `off`.
 */
export type OtherFormGrade = 'correct' | 'minor_error' | 'off';

/**
 * `core` slots decide the exercise's result (worst of them). `support` slots only
 * scale the reward: a grammar sentence's vocab blanks never turn a demonstrated
 * construction into a failure.
 */
export type SlotRole = 'core' | 'support';

/** Set on a slot that asks for one dictionary word. */
export interface SlotWord {
    /**
     * The word this slot practises, credited when it is answered right. Absent on a
     * grammar marker, which practises the point rather than the word.
     */
    vocabId?: string;
    /** Names the word in feedback ("the word being tested was 狭い (せまい)"). */
    label: string;
    /** Names the word in the session ticker, where a credit to it is listed. */
    headword: string;
    lemma: InflectableWord | null;
    otherForm: OtherFormGrade;
    /** Its near-synonyms, tried only once the answer has missed the word itself. Empty turns the rule off. */
    synonyms: SynonymCandidate[];
}

/**
 * A conjugated word inside a slot's text (ある in があります), with the text around
 * it: the same text with the word in another of its forms is the right construction
 * in another conjugation. Only politeness changed (がある): correct, unless the card
 * asks for a register. Anything else (がありません, があった): a near miss.
 */
export interface SlotInflection {
    /** The slot's text before the word, in each spelling (written, kana). `''` when the word starts it. */
    lead: string[];
    word: InflectableWord;
    /** The word as the slot's text has it, inflection included (あります), in each spelling. */
    form: string[];
    /** The slot's text after the word's inflection, in each spelling. `''` when the word ends it. */
    tail: string[];
    /** True when the card asks for no register (no formality hint, or neutral), so plain for polite is right. */
    registerFree: boolean;
}

/** One answer the learner types. Built once when the exercise is built, so grading stays pure and synchronous. */
export interface AnswerSlot {
    /** Forms graded `correct` (a typo of one is a `minor_error`). */
    accept: string[];
    /** Forms that are right but not ideal (the wrong register, the dictionary form of a conjugated word): `minor_error` at best. */
    near: string[];
    leniency: Leniency;
    role: SlotRole;
    /** What a fully revealed hint writes into the input, and the form a missed slot shows. */
    reveal: string;
    /** The first hint level. Empty when there is none. */
    gloss: string;
    word?: SlotWord;
    /** The conjugated words of a grammar marker, each a near miss in any other conjugation. */
    inflections?: SlotInflection[];
}

/** A slot answered with one of its word's near-synonyms instead of the word. */
export interface SynonymAnswer {
    vocabId: string;
    /** The typed word's headword, for the link to its page. */
    written: string;
    /** The typed word with its reading, for the feedback message. */
    label: string;
    /** `confusable` is neutral: no credit, no penalty. */
    outcome: SynonymOutcome;
    /** The shared meaning the cue uses, when it uses one. */
    meaning: string | null;
}

export interface SlotGrade {
    result: AnswerResult;
    /** The accepted form shown next to the answer: the one it matched, or `reveal`. */
    shown: string;
    synonym?: SynonymAnswer;
}

interface ExerciseBase {
    /** The item this exercise reviews. */
    host: HostItem;
    /** Names the item in the session ticker. */
    label: string;
    slots: AnswerSlot[];
    /** The text in front of the learner, which decides whether a near-synonym answers a slot. */
    cue: ProductionCue;
}

/**
 * One exercise: what it asks (slots), what decides a synonym (cue), and what its card
 * shows, keyed by kind. ExerciseCard switches on `kind`, so a new kind fails to compile
 * until it has a card.
 */
export type Exercise = ExerciseBase & (
    | { kind: 'reading' }
    /** `sentence` is the context sentence; `contextRequested` without one shows the fallback note. */
    | { kind: 'meaning'; sentence: Sentence | null; contextRequested: boolean }
    | { kind: 'production' }
    | { kind: 'production-cloze'; cloze: ProductionCloze; sentence: ClozeSentence }
    | { kind: 'grammar-cloze'; sentence: ClozeSentence; realization?: GrammarRealization }
    | { kind: 'conjugation'; prompt: GrammarConjugationPrompt }
    /** Nothing in the point's examples can be blanked: the sentence is shown to read. */
    | { kind: 'study'; sentence: Sentence }
);

/** The exercise as the grader reads it. */
export type GradedExercise = Pick<Exercise, 'kind' | 'slots' | 'cue'>;

/** The exercise as its effects read it: what was asked, of which item. */
export type AnsweredExercise = Pick<Exercise, 'kind' | 'host' | 'label' | 'slots'>;

export interface ExerciseGrade {
    slots: SlotGrade[];
    /** The exercise's result: the worst of its deciding core slots. */
    overall: AnswerResult;
    /** Scales the strength gain by how many support slots were right; 1 when there is nothing to scale. */
    strengthModifier: number;
    /** True only when every slot was answered strictly right with the word itself, so there is nothing to read. */
    autoAdvance: boolean;
    message: string;
}
