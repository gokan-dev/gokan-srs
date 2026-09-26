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
 * Near-synonym clusters for production-quiz grading (issue #71 Part B), keyed
 * by vocab id -> the OTHER vocab ids it collides with plus their relation tier.
 * Symmetric (if A lists B, B lists A). Membership is auto-derived at dataset
 * build time from same-POS gloss overlap; the tier is hand-authored, starting
 * with the highest-traffic clusters. A word with no entry is inert - it grades
 * exactly as it would with no synonym handling at all.
 */
export type SynonymIndex = Record<string, Array<{ id: string; relation: SynonymRelation }>>;