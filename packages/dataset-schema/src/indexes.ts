/** `index/kklc.json`: KKLC step -> vocab ids unlocked at that step. Words learned in kana are not in it. */
export type KKLCIndex = Record<number, string[]>;

/** `index/kklc-kanji.json`: KKLC step -> kanji introduced at that step. */
export type KKLCKanjiIndex = Record<number, string[]>;

/**
 * One vocab in a learning-order index: its id and the kanji a learner must know to
 * be shown it. A word learned in kana (`usuallyKana`) needs none, so its list is
 * empty; its vocab file still lists its kanji spelling's kanji.
 */
export interface VocabIndexEntry {
    id: string;
    containedKanji: string[];
    usuallyKana?: true;
}

/** `index/frequency.json`: every vocab, most frequent first (a word learned in kana at its kana spelling's rank). */
export type FrequencyIndex = VocabIndexEntry[];

/** `index/kanji-vocab.json`: kanji -> vocab ids containing it, most frequent first. */
export type KanjiVocabIndex = Record<string, string[]>;

/**
 * `index/jlpt.json`: JLPT level (1 = N1 hardest .. 5 = N5 easiest) -> vocab at that
 * level, most frequent first. Entries mirror FrequencyIndex's shape so candidate
 * finding can share the same filtering.
 */
export type JlptIndex = Record<number, VocabIndexEntry[]>;

/** Easiest first: the order a learner meets the levels in. */
export const JLPT_LEVELS = [5, 4, 3, 2, 1] as const;

/** `index/search.json`: one compact row per vocab for client-side search. */
export interface SearchIndexEntry {
    id: string;
    /** Written form (kanji). */
    w: string;
    /** Reading. */
    r: string;
    /** Meaning. */
    m: string;
    /** Learned in kana (Vocabulary.usuallyKana): show `r` as the headword. */
    u?: true;
}

export type SearchIndex = SearchIndexEntry[];
