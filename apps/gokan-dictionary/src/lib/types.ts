// Lightweight cross-page view types and the dictionary's own search index format. The prerender
// script resolves summaries once per referenced id and passes them down as props, so a page
// linking to another entry never embeds that entry's full dataset object.

export interface VocabSummary {
    id: string;
    /** The headword (headwordOf): the kanji spelling, or the kana for a word learned in kana. */
    word: string;
    /**
     * The kana reading, only when it differs from the headword. Never a word learned in kana's
     * rare kanji spelling: that appears only on the word's own page.
     */
    reading?: string;
    /** The first sense's glosses, cut short (shortGloss). */
    gloss?: string;
}

/**
 * The GrammarPoint equivalent, used for a page's family/related-points list. Kept to the fields a
 * row needs so a family of 6 points doesn't pull 6 full points (with all their examples) into
 * one page's props.
 */
export interface GrammarSummary {
    id: string;
    title: string;
    jlptLevel: number;
    romaji?: string;
    /** The short explanation, cut short for a list row. */
    shortExplanation?: string;
}

/**
 * One word of the search index, as a compact array (it is downloaded, ~36k times over):
 * id, headword (searchHeadword), secondary form (the reading, or a word learned in kana's kanji
 * spelling), the short gloss, JLPT level (0 for none) and flags (searchFlags in searchIndex.ts:
 * common, learned in kana, conjugation class). Rows are in frequency order, so a row's position
 * is its frequency rank.
 */
export type SearchWordRow = [id: string, headword: string, secondary: string, gloss: string, jlpt: number, flags: number];

/** One kanji: the character, JLPT level (0 for none) and frequency rank (0 for none). */
export type SearchKanjiRow = [character: string, jlpt: number, frequency: number];

/** One grammar point, in teaching order: id, title, romaji ('' for none), short explanation, JLPT level. */
export type SearchGrammarRow = [id: string, title: string, romaji: string, explanation: string, jlpt: number];

/**
 * A search index file. `search-core.json` carries every JLPT word, the most frequent words, every
 * kanji and every grammar point; `search-full.json` only the remaining words. Read after the core,
 * the full file's rows rank after it, which is their place anyway: each is rarer than every
 * non-JLPT core word, and JLPT words rank first whatever their frequency.
 */
export interface SearchIndexFile {
    w: SearchWordRow[];
    k?: SearchKanjiRow[];
    g?: SearchGrammarRow[];
}
