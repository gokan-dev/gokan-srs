/** Where a vocab occurs in a sentence: a span of `Sentence.original`. */
export interface SentenceMatch {
    start: number;
    length: number;
    reading?: string;
}

/** One example sentence, from `compiled/sentences/{vocabId}.json` (an array of these). */
export interface Sentence {
    /** Source sentence ID. */
    id: string;
    /** Japanese text. */
    original: string;
    en: {
        /** English sentence ID from the source. */
        id: string;
        /** English translation. */
        text: string;
    }[];
    /** Reading hints/furigana string, if available. */
    indices?: string;
    /** Every vocab the sentence contains (for containment checks). */
    vocabIds: string[];
    /** vocabId -> where it occurs, for highlighting and linking. Always arrays. */
    matches?: Record<string, SentenceMatch[]>;
}

export interface SentenceSet {
    vocabId: string;
    sentences: Sentence[];
}
