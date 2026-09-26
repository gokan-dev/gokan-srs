import { DEFAULT_SRS_ENTRY } from './vocabulary.model';
import type { SRSEntry } from './vocabulary.model';

/**
 * One tokenized word within a GrammarExample's Japanese sentence. `vocabId` is
 * resolved at build time by matching this word's surface/dictionary form against
 * the compiled vocab dataset - null for particles, symbols, and anything that
 * couldn't be resolved, which are always shown literally and never turned into
 * a blank. Concatenating every word's `surface` in order reconstructs the
 * example's `jp` string exactly.
 */
export interface GrammarExampleWord {
    surface: string;
    vocabId: string | null;
    /** The matched vocab's primary reading (hiragana) - only set when vocabId is set. Used to grade a blank without a runtime vocab fetch. */
    reading?: string;
    /** Kuromoji's dictionary/base form (e.g. "思う" for the conjugated token "思っ"), only set when it differs from `surface`. Currently unused at runtime - captured for parity with the dataset schema, which uses it for build-time pattern-word matching (see `patternWordIndices` below). */
    baseForm?: string;
}

export interface GrammarExample {
    jp: string;
    romaji: string;
    en: string;
    words: GrammarExampleWord[];
    /**
     * Indices into `words[]` identifying this example's grammar-pattern markers
     * (the literal, invariant part of the point's `formation` - e.g. が and
     * いちばん for "Noun + が + いちばん + Adjective/Verb"), precomputed at
     * dataset build time by matching `formation` against `words[]`. Always
     * present (possibly empty) - the app never re-derives this. Empty means the
     * pattern couldn't be confidently located in this specific example (rare -
     * 98.1% of examples have it non-empty as of the dataset's last build; see
     * `computeBlankPlan`'s fallback chain in grammarSelectors.ts for what
     * happens then).
     */
    patternWordIndices: number[];
}

/**
 * A single grammar point (e.g. "A が いちばん～"). Sourced from the
 * hanabira.org-japanese-content dataset (CC license, attribution required -
 * see the credit link on the About page) - see CLAUDE.md's Grammar section
 * for the full ingestion story.
 */
export interface GrammarPoint {
    /** Stable id assigned at build time from this vendored snapshot (e.g. "n5-001") - the upstream dataset has no ids of its own. */
    id: string;
    /** Japanese/pattern portion only, e.g. "～けど、～" - the upstream title bundled this with a romaji transliteration in a trailing parenthetical; build-time splits them apart (see `romaji` below). */
    title: string;
    /** Romaji transliteration split off `title`'s original trailing parenthetical, e.g. "kedo". Absent for the ~1.3% of points (9/828) with no cleanly-splittable trailing parenthetical - a dataset-side gap, not something the app fixes. */
    romaji?: string;
    /** JLPT level (1 = N1 hardest .. 5 = N5 easiest), matching Vocabulary.jlptLevel's convention. Every grammar point carries one, since this dataset is itself organized by level. */
    jlptLevel: number;
    shortExplanation: string;
    longExplanation: string;
    /** Formation template shown to the user, e.g. "Noun + が + いちばん + Adjective/Verb". */
    formation: string;
    /**
     * The nature of this point, which decides which exercise can test it. The
     * discriminating test is about the answer key: **can you write the correct
     * answer without knowing which word it attaches to?**
     *
     *  - 'construction' yes - identity is a fixed string (ので, ことがある).
     *                   The existing cloze quiz tests it.
     *  - 'inflection'   no - identity is an operation and the answer differs per
     *                   input word (飲む→飲んで, する→して). Nothing invariant to
     *                   blank, so the cloze quiz CANNOT test it. Excluded from the
     *                   introduction pipeline until a transformation quiz exists.
     *  - 'lexical'      yes, but the answer is one dictionary word (いつも).
     *
     * See the dataset's docs/SCHEMA.md. 768 / 20 / 0 as of the last build.
     */
    kind?: 'construction' | 'inflection' | 'lexical';
    /** For `kind: 'inflection'`: which derivation the point teaches, e.g. "て-form". */
    derives?: string;
    /**
     * Set when this point is a realization VARIANT of another: the same
     * construction with one slot filled differently (どこへも Verb ません is
     * どこにも Verb ません with a different particle). Variants are browsable but
     * are NOT introduced separately - the canonical carries one SRS entry and the
     * quiz rotates through the realizations, so mastery is shared.
     *
     * Never set for lexical siblings: でも / しかし / けれども are different words
     * and stay separate items.
     */
    variantOf?: string;
    /** The operation relating this point to its canonical. */
    variantRelation?: string;
    examples: GrammarExample[];
    /**
     * Register/formality of this point, for points that have one (most don't -
     * plain descriptive constructions with no close synonym leave this unset).
     * Sourced from gokan-dataset's hand-authored formality.json mapping, not
     * derived at build time - see CLAUDE.md's Grammar Dataset section. Exists
     * specifically so a quiz card can disambiguate near-synonym points that
     * differ mainly by register (e.g. でも/しかし/けれども all gloss as "but").
     */
    formalityLevel?: 'casual' | 'neutral' | 'polite' | 'formal' | 'very-formal-literary';
    /**
     * The syntactic slot this point's marker occupies (from the dataset). The gate
     * for interchangeability grading: two family siblings can only substitute for
     * one another in a cloze blank if they fill the same slot. けど (clause-final)
     * and でも (sentence-initial) both mean "but" and share a family, but でも in a
     * clause-final けど blank is ungrammatical, so that substitution grades wrong,
     * not as a minor register slip. Absent where unclassified.
     */
    slot?: 'clause-final' | 'sentence-initial' | 'predicate-final' | 'pre-noun' | 'adverbial';
    /**
     * One short, quiz-card-length line (~60-80 chars) covering whatever actually
     * disambiguates this point from its near-synonyms - usually register, but
     * sometimes connotation/nuance instead (criticism, surprise, unmet
     * expectation). Deliberately not a duplicate of longExplanation.
     */
    usageNote?: string;
    /**
     * The named near-synonym family this point belongs to, if any - replaces
     * the earlier flat `relatedPoints?: string[]` field. `relatedPoints` here
     * is DERIVED at dataset build time from every other point sharing the same
     * `family.id` (symmetric by construction - if A lists B, B lists A).
     * Absent for points with no close synonym cluster.
     */
    family?: {
        /** Stable slug, e.g. "contradiction" - shared by every member. */
        id: string;
        /** Display name, e.g. "Contradiction (But / However)". */
        name: string;
        /** Ids of the OTHER points in this family. */
        relatedPoints: string[];
        /**
         * What this member adds over its family siblings - the field that makes
         * a near-synonym cluster teachable instead of merely adjacent.
         *
         *  - 'register'   differs ONLY by formality. Show the ladder, with the
         *                 siblings the user already knows marked.
         *  - 'constraint' adds a semantic restriction that can be got wrong
         *                 (おかげで frames the cause favourably, ばかりに
         *                 unfavourably). Lead with that restriction.
         *  - 'variant'    no differentiator exists; the siblings are
         *                 interchangeable stylistic choices. Say so, rather than
         *                 inviting the user to hunt for a difference.
         *
         * Absent for members the dataset hasn't classified. See the dataset's
         * docs/SCHEMA.md (`family.axis`).
         */
        axis?: GrammarAxis;
    };
}

export type GrammarAxis = 'register' | 'constraint' | 'variant';

/** JLPT level (1..5) -> grammar point ids, in the source's original order (alphabetical - grammar has no frequency data to sort by, unlike vocab). */
export type GrammarJlptIndex = Record<number, string[]>;

export const GRAMMAR_JLPT_LEVELS = [5, 4, 3, 2, 1] as const;

/**
 * One chapter of the dataset's authored teaching order - a run of grammar points
 * meant to be met together. Mirrors the dataset's GrammarChapter (see its
 * docs/SCHEMA.md for `index/teaching-order.json`).
 */
export interface GrammarChapter {
    /** Stable slug, e.g. "n5-c17" - safe to persist. */
    id: string;
    title: string;
    summary: string;
    /**
     * The chapter's POSITION in the curriculum, not a claim about every member's
     * own level: a chapter legitimately contains harder points when they are
     * register siblings of something it already teaches (だが N2 sits in the N5
     * "But" chapter, because it adds only formality).
     */
    jlptLevel: number;
    points: string[];
}

/**
 * The dataset's authored introduction order. `order` is the flattening of
 * `chapters` - every non-duplicate point exactly once - provided so a consumer
 * that only needs "what comes next" doesn't have to flatten it.
 */
export interface GrammarTeachingOrder {
    order: string[];
    chapters: GrammarChapter[];
}

/**
 * One CASE inside a lesson: a concrete situation, which point to reach for in
 * it, and why the obvious alternative does not fit.
 * Compiled from the dataset's `data/raw/grammar/contrasts.json` into
 * `compiled/grammar/index/contrasts.json`. Directed so `focus` is the point met
 * LATER in the teaching order: by the time it is introduced the `vs` siblings
 * are already known, so the app surfaces the case at `focus`'s introduction
 * (deferring it if a `vs` sibling isn't known yet) and on the family page.
 */
export interface GrammarContrastCase {
    focus: string;
    vs: string[];
    situation: string;
    guidance: string;
}

/**
 * A LESSON: a confusability-first sub-grouping of a family - a small set of
 * points (target 5-6, soft cap) close enough to be actively disambiguated
 * together, like interleaving look-alike kanji. A small family can be one
 * lesson; a large one is split. Every case belongs to one lesson and may only
 * name points that lesson covers.
 *
 * A lesson is NOT a chapter. A chapter is a slot in the introduction order; a
 * lesson is a set of confusable points. They are unrelated groupings, and a
 * lesson may span chapters - see `taughtInChapterId`.
 */
export interface GrammarContrastLesson {
    id: string;
    /** Short display title, e.g. "から / ので". */
    title: string;
    /** The confusable points this lesson covers. */
    points: string[];
    /** The situations taught here. Each case's focus/vs are a subset of `points`. */
    cases: GrammarContrastCase[];
    /**
     * The chapter this lesson can first be taught in: the chapter of whichever
     * point it covers the teaching order introduces LAST, stamped at dataset
     * build time. The app does not gate on it (the `vs`-known check in
     * `selectReadyContrasts` is the runtime equivalent, and is per-learner
     * rather than per-curriculum), but it is what a chapter-end lesson would
     * key off if the grammar session ever grows one.
     */
    taughtInChapterId?: string;
}

/**
 * Family id -> its authored contrast lessons, from
 * `compiled/grammar/index/contrasts.json`.
 */
export type GrammarContrastIndex = Record<string, {
    name: string;
    lessons: GrammarContrastLesson[];
    /**
     * The family's `variant`-axis members, when it has two or more: siblings
     * that are genuinely interchangeable, so no lesson exists or could exist
     * for them (the dataset build rejects one that tries). Shown as a note
     * instead, because silence is worse - a learner who meets ten near-identical
     * literary forms with no comment assumes a distinction exists and goes
     * looking for one.
     *
     * A family can carry this and NO lessons at all, so `lessons: []` is a valid
     * entry rather than a missing one.
     */
    interchangeable?: string[];
}>;

/**
 * One point's interchangeable siblings, flattened with the family context, for
 * lookup by point id. `siblings` excludes the point itself.
 */
export interface GrammarInterchangeableForPoint {
    familyId: string;
    familyName: string;
    siblings: string[];
}

/** A contrast case flattened with the family/lesson context it came from, keyed for lookup by its focus point. */
export interface GrammarContrastForFocus {
    familyId: string;
    familyName: string;
    lessonId: string;
    lessonTitle: string;
    case: GrammarContrastCase;
}

/**
 * Dropped duplicate point id -> the surviving canonical id, from the dataset's
 * `index/aliases.json`. 40 upstream points were the same pattern ingested twice
 * (～ても was both n3-052 and n4-097); the dataset now emits only the canonical
 * one. Stored user progress against a dropped id has to be transferred, or it
 * becomes an item that can never be loaded OR cleared - see MigrationService.
 */
export type GrammarAliasIndex = Record<string, string>;

/**
 * Point id -> kind, from the dataset's `index/kinds.json`. Exists so the
 * introduction pipeline can filter by kind without fetching 788 point files to
 * read one field each.
 */
export type GrammarKindIndex = Record<string, NonNullable<GrammarPoint['kind']>>;

/** One realization within a variant group. The canonical is included, with relation 'canonical'. */
export interface GrammarVariantMember {
    id: string;
    relation: string;
    formalityLevel?: NonNullable<GrammarPoint['formalityLevel']>;
    title: string;
}

/**
 * Canonical point id -> every realization of that rule, from the dataset's
 * `index/variant-groups.json`. Lets the quiz rotate through the realizations
 * against the canonical's single SRS entry, which is what makes mastery shared
 * rather than six separate climbs for one pattern.
 */
export type GrammarVariantGroupIndex = Record<string, GrammarVariantMember[]>;

/**
 * One summary row per point, from the dataset's `index/browse.json`. Carries
 * everything a browse card needs so the page does not have to fetch 788
 * individual point files; the full point is one fetch away on the detail route.
 */
export interface GrammarBrowseRow {
    id: string;
    title: string;
    romaji?: string;
    jlptLevel: number;
    kind: NonNullable<GrammarPoint['kind']>;
    derives?: string;
    formation: string;
    shortExplanation: string;
    formalityLevel?: NonNullable<GrammarPoint['formalityLevel']>;
    usageNote?: string;
    familyId?: string;
    familyName?: string;
    axis?: GrammarAxis;
    /** Set when this point is a realization variant taught via its canonical. */
    variantOf?: string;
    variantRelation?: string;
    /** Position in the introduction order, or null when deliberately excluded. */
    orderIndex: number | null;
    chapterId?: string;
    chapterTitle?: string;
    exampleCount: number;
    anchoredExampleCount: number;
    conjugationItems?: number;
}

export interface GrammarBrowseIndex {
    points: GrammarBrowseRow[];
    stats: {
        points: number;
        introduced: number;
        variants: number;
        variantGroups: number;
        families: number;
        unfamilied: number;
        chapters: number;
        byLevel: Record<string, number>;
        byKind: Record<string, number>;
        byAxis: Record<string, number>;
    };
}

/** A derived form the transformation quiz can ask for. Mirrors the dataset's ConjugationForm. */
export type ConjugationForm =
    | 'te' | 'tai' | 'zu' | 'chatta' | 'toku'
    | 'causative' | 'causative-passive' | 'passive' | 'potential'
    // Base paradigm (tense x polarity x politeness) and mood/conditional,
    // from the base-conjugation-paradigm rollout (23 new inflection points).
    | 'plain-past' | 'plain-negative' | 'plain-past-negative'
    | 'masu' | 'masu-past' | 'masu-negative' | 'masu-past-negative'
    | 'volitional' | 'imperative' | 'prohibitive' | 'ba'
    | 'i-adj-adverbial' | 'i-adj-te' | 'i-adj-negative-polite'
    | 'i-adj-negative' | 'i-adj-past' | 'i-adj-past-negative' | 'i-adj-ba'
    | 'na-adj-adverbial' | 'na-adj' | 'na-adj-past' | 'na-adj-negative'
    | 'na-adj-past-negative' | 'na-adj-polite' | 'na-adj-past-polite'
    | 'na-adj-negative-polite' | 'na-adj-te';

/** One drill: conjugate `lemma` into `target`. */
export interface ConjugationDrillItem {
    /** Keyed on the vocab id, not the surface, so 入る (はいる / いる) is unambiguous. */
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
 * Drill items for every `kind: 'inflection'` point, from the dataset's
 * `grammar/conjugations.json`. These points teach a derivation, so there is no
 * invariant marker for the cloze quiz to blank - they are served by the
 * transformation card instead, and a point with no entry here stays out of the
 * introduction pipeline entirely.
 */
export type GrammarConjugationIndex = Record<string, {
    form: ConjugationForm;
    /** Shown to the learner as the prompt, e.g. "て-form". */
    formLabel: string;
    items: ConjugationDrillItem[];
}>;

/**
 * User's SRS progress for one grammar point. Mirrors VocabProgress but with a
 * single SRSEntry (no reading/meaning split) - a grammar quiz has exactly one
 * quiz type, the fill-in-the-blank translation exercise.
 */
export interface GrammarProgress {
    grammarId: string;
    stage: 'learning' | 'graduated';
    introductionAt: Date | null;
    nextReviewAt: Date | null;
    lastReviewedAt: Date | null;
    totalReviews: number;
    consecutiveFailures: number;
    entry: SRSEntry;
    /** Immediate-retry flag, mirroring VocabProgress.needsRetry but a single boolean (only one quiz type here). */
    needsRetry?: boolean;
}

export const DEFAULT_GRAMMAR_PROGRESS: GrammarProgress = {
    grammarId: '',
    stage: 'learning',
    introductionAt: null,
    nextReviewAt: null,
    lastReviewedAt: null,
    totalReviews: 0,
    consecutiveFailures: 0,
    entry: { ...DEFAULT_SRS_ENTRY },
};
