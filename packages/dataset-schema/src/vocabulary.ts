/** One vocabulary entry, `compiled/vocab/{id}.json`. */
export interface Vocabulary {
    /** JMdict word ID (lexeme-level, stable) */
    id: string;

    /** Primary written form (common kanji form) */
    writtenForm: {
        kanji: string;
        alternatives: string[]; // alternative kanji writings
        containedKanji: string[];
    };

    /** Reading information */
    reading: {
        primary: string;        // main reading shown on intro card
        alternatives: string[]; // other valid readings (rare, secondary)
    };

    /** Frequency information */
    frequency: {
        kanjiRank: number;
        kanaRank?: number;
    };

    /** JLPT level (1=N1 hardest ... 5=N5 easiest), if this word is JLPT-tagged. Descriptive/display-only - not used for learning order. */
    jlptLevel?: number;

    /** Learning order constraints */
    progression: {
        kklcStep: number;
    };

    /** IDs of other vocabularies contained within this one (for inheritance) */
    components?: string[];

    /** IDs of other vocabularies this word is a component of */
    parents?: string[];

    /** Linguistic senses (kept separate, structured) */
    senses: Sense[];

    /** Derived helpers for card generation (optional but useful) */
    usageHints?: UsageHints;

    /** If this entry is a unified merged entry from multiple homographs sharing the exact kanji form */
    mergedVocabs?: MergedVocabInfo[];

    /**
     * True if JMdict marks this word (or an absorbed homograph) as common. The dataset
     * always writes it; optional here only because hand-built fixtures and older cached
     * files may lack it.
     */
    isCommon?: boolean;

    /**
     * Near-synonyms for production-quiz grading, embedded at dataset build time
     * (build-synonyms.ts) rather than in a monolithic index - see VocabSynonym.
     * Absent when this word has no near-synonyms; a wrong production answer
     * matching one of these grades by its relation tier instead of flat wrong.
     */
    synonyms?: VocabSynonym[];

    /**
     * Learned in kana: ここ, not its rare kanji spelling 此処. Shown by its reading
     * (headwordOf), learnable without knowing any kanji, outside the kanji-driven
     * orders, and with no reading quiz. Decided at dataset build time; absent otherwise.
     */
    usuallyKana?: true;
}

export interface MergedVocabInfo {
    /** The original JMDict ID of the merged word */
    id: string;
    /** True if this was the highest frequency word that absorbed the others */
    isBase: boolean;
    /** The original primary reading for this specific word */
    originalPrimaryReading: string;
    /** A quick summary of what this specific reading meant (e.g. its main glosses) */
    originalGlosses: string[];
}

export interface Sense {
    /** Part(s) of speech for THIS sense */
    pos: string[];

    /** Register / usage flags (arch, abbr, suffix, etc.) */
    misc: {
        isAbbreviation?: boolean;
        isSuffix?: boolean;
        isPrefix?: boolean;
        isArchaic?: boolean;
        isRare?: boolean;
        rawTags: string[]; // kept for display/debug, not logic
    };

    /** Meanings, grouped by sense */
    glosses: string[];

    /** Structured related terms (for context generation) */
    related: {
        compounds: string[]; // e.g. 中学校, 中国
    };

    /** If this sense only applies to specific readings (used for disambiguating merged vocabs) */
    appliesToReadings?: string[];
}

export interface UsageHints {
    /** Suggested minimal context for intro card */
    examplePattern?: string; // e.g. "〜中", "Xの中"

    /** True if reading depends on context (homograph warning) */
    requiresContext: boolean;
}

/**
 * `interchangeable`: either word genuinely answers the same production cue.
 * `confusable`: overlapping glosses, but a distinct, non-interchangeable word.
 */
export type SynonymRelation = 'interchangeable' | 'confusable';

/**
 * One near-synonym of a vocab, for production-quiz grading: another vocab id it
 * collides with, plus its relation tier. Delivered per vocab (each `Vocabulary`
 * carries its own `synonyms` list) rather than in one monolithic index, since at full
 * coverage that file is too large to load whole. Symmetric (if A lists B, B lists A).
 */
export interface VocabSynonym {
    id: string;
    /** Out-of-context tier: what the pair earns when the card does not use a shared meaning. */
    relation: SynonymRelation;
    /**
     * Normalized glosses both words carry. A pair is a synonym IN A SENSE: when the
     * card's sentence or printed glosses use one of these, the answer counts as
     * correct. Absent on data built before it.
     */
    shared?: string[];
    /** Shared glosses over the smaller word's gloss count. */
    overlap?: number;
    /** Tier set by hand in the dataset; never upgraded from context. */
    curated?: boolean;
    /**
     * The other word's answerable forms, embedded so grading a wrong answer never
     * fetches its vocab file: written forms (kanji first, empty for a kana-only
     * word), readings (primary first, merged homographs' readings included) and its
     * inflecting POS codes. The build writes them on every entry, so grading is
     * synchronous.
     */
    w: string[];
    r: string[];
    pos?: string[];
    /** The other word is learned in kana (Vocabulary.usuallyKana): name it by `r[0]`. */
    u?: true;
}
