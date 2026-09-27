// Grammar models, mirroring apps/gokan-srs/src/models/grammar.model.ts (see the note in
// Project Structure about this app carrying its own copy of the shared model files).
//
// Deliberately a SUBSET of gokan-srs's version: only the fields the dictionary's static pages
// actually render are declared here. The SRS-side progress types (GrammarProgress) and the
// browse index shape have no meaning on a public reference page, so copying them would only
// create surface area to drift.

export interface GrammarExampleWord {
    surface: string;
    vocabId: string | null;
    reading?: string;
    baseForm?: string;
}

export interface GrammarExample {
    jp: string;
    romaji: string;
    en: string;
    words: GrammarExampleWord[];
    patternWordIndices: number[];
}

export interface GrammarPoint {
    id: string;
    /** Japanese/pattern portion only, e.g. "～けど、～". */
    title: string;
    /** Transliteration split off `title` at build time; absent for a small residue of points. */
    romaji?: string;
    /** 1 (N1, hardest) .. 5 (N5, easiest). Every grammar point has one. */
    jlptLevel: number;
    shortExplanation: string;
    longExplanation: string;
    formation: string;
    kind?: 'construction' | 'inflection' | 'lexical';
    examples: GrammarExample[];
    formalityLevel?: 'casual' | 'neutral' | 'polite' | 'formal' | 'very-formal-literary';
    usageNote?: string;
    family?: {
        id: string;
        name: string;
        /** Ids of the OTHER points in this family (excludes this point's own id). */
        relatedPoints: string[];
    };
    /** Set when this point is a realization variant of another (issue #58). `variantOf` is the canonical's id. */
    variantOf?: string;
    variantRelation?: string;
}

/** grammar/index/jlpt.json: JLPT level (as a string key) -> ordered grammar point ids. */
export type GrammarJlptIndex = Record<string, string[]>;

/**
 * One chapter of the dataset's authored teaching order (issue #58) - a run of
 * grammar points meant to be met together. Mirrors gokan-srs's own
 * `GrammarChapter`; see that app's CLAUDE.md Core Data Models section.
 */
export interface GrammarChapter {
    id: string;
    title: string;
    summary: string;
    jlptLevel: number;
    points: string[];
}

/** grammar/index/teaching-order.json: the flat introduction order plus its chapter grouping. */
export interface GrammarTeachingOrder {
    order: string[];
    chapters: GrammarChapter[];
}

/**
 * One CASE inside a contrast lesson: a concrete situation, which point to reach
 * for, and why the obvious alternative does not fit. `focus` is the point met
 * LATER in the teaching order - see gokan-srs's CLAUDE.md for the full model.
 */
export interface GrammarContrastCase {
    focus: string;
    vs: string[];
    situation: string;
    guidance: string;
}

/** A confusability-first sub-grouping of a family: a small set of points worth actively disambiguating together. */
export interface GrammarContrastLesson {
    id: string;
    title: string;
    points: string[];
    cases: GrammarContrastCase[];
    taughtInChapterId?: string;
}

/** Family id -> its authored contrast lessons, from grammar/index/contrasts.json. */
export type GrammarContrastIndex = Record<string, {
    name: string;
    lessons: GrammarContrastLesson[];
    /** The family's `variant`-axis members, when it has two or more - genuinely interchangeable, so no lesson exists for them. */
    interchangeable?: string[];
}>;

/** One realization within a variant group. The canonical is included, with relation 'canonical'. */
export interface GrammarVariantMember {
    id: string;
    relation: string;
    formalityLevel?: NonNullable<GrammarPoint['formalityLevel']>;
    title: string;
}

/** Canonical point id -> every realization of that rule, from grammar/index/variant-groups.json. */
export type GrammarVariantGroupIndex = Record<string, GrammarVariantMember[]>;

/** One drill: conjugate `lemma` into `target`. Mirrors gokan-srs's ConjugationDrillItem. */
export interface ConjugationDrillItem {
    vocabId: string;
    lemma: string;
    lemmaReading: string;
    target: string;
    targetReading: string;
    /** Other equally correct answers, e.g. 書かされる for the causative-passive. */
    alternatives?: string[];
    wordClass: 'godan' | 'ichidan' | 'irregular' | 'i-adjective' | 'na-adjective';
}

/**
 * Drill items for every `kind: 'inflection'` point, from grammar/conjugations.json.
 * Keyed loosely as `string` rather than gokan-srs's closed `ConjugationForm` union: this app
 * only displays `form`/`formLabel`, never branches on the specific value, so there is nothing
 * to gain from coupling to that union (which the dataset has already outgrown once).
 */
export type GrammarConjugationIndex = Record<string, {
    form: string;
    formLabel: string;
    items: ConjugationDrillItem[];
}>;
