// Lightweight cross-page view type. Used wherever a page needs to link to *another* vocab
// entry without embedding that entry's full Vocabulary object (kanji breakdown lists, a
// kanji's associated-vocab list, a word's components/parents) - the prerender script resolves
// these summaries once per referenced id and passes them down as props.

export interface VocabSummary {
    id: string;
    /** The headword (headwordOf): the kanji spelling, or the kana for a word learned in kana. */
    word: string;
    /** Shown beside it (secondaryForm): the reading, or that word's kanji spelling. */
    secondary: string;
    gloss?: string;
}

/**
 * The GrammarPoint equivalent, used for a page's family/related-points list. Kept to the three
 * fields a link needs so a family of 6 points doesn't pull 6 full points (with all their
 * examples) into one page's props.
 */
export interface GrammarSummary {
    id: string;
    title: string;
    jlptLevel: number;
}
