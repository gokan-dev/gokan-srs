export interface KKLCIndex {
    [step: number]: string[];
}

export type FrequencyIndex = Array<{
    id: string,
    containedKanji: string[]
}>

export type KKLCKanjiIndex = Record<number, string[]>;

export type KanjiVocabIndex = Record<string, string[]>;

/**
 * JLPT level (1 = N1 hardest .. 5 = N5 easiest) -> vocab at that level,
 * sorted by frequency rank. Entries mirror FrequencyIndex's shape so the
 * candidate-finding code can share the same filtering.
 */
export type JlptIndex = Record<number, Array<{
    id: string;
    containedKanji: string[];
}>>;

export const JLPT_LEVELS = [5, 4, 3, 2, 1] as const;

export interface SearchIndexEntry {
    id: string;
    w: string; // kanji
    r: string; // reading
    m: string; // meaning
}

export type SearchIndex = SearchIndexEntry[];

/**
 * `interchangeable`: either word genuinely answers the same production cue.
 * `confusable`: overlapping glosses, but a distinct, non-interchangeable word.
 */
export type SynonymRelation = 'interchangeable' | 'confusable';

/**
 * One near-synonym of a vocab, for production-quiz grading (issue #71 Part B):
 * another vocab id it collides with, plus its relation tier. Delivered per-vocab -
 * each `Vocabulary` carries its own `synonyms` list (see vocabulary.model.ts),
 * embedded at dataset build time (build-synonyms.ts) rather than in one monolithic
 * index, since at full coverage that file is too large to load whole. Symmetric
 * (if A lists B, B lists A). A word with no list is inert - it grades exactly as
 * it would with no synonym handling at all.
 */
export interface VocabSynonym {
    id: string;
    relation: SynonymRelation;
}