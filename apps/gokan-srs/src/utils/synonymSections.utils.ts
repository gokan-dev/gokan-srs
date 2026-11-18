import { synonymSections as senseSynonymSections } from '@gokan/dataset-schema';
import type { Sense, SenseSynonyms } from '@gokan/dataset-schema';
import type { ListedSynonym } from '../services/exercise/wordRelation';

/**
 * A word's synonyms as its page shows them: the sections, their order and the frequent-word cut are
 * shared with the dictionary (`synonyms.ts` in @gokan/dataset-schema); this is the learner's layer
 * on top (the words they mixed up and study) and the Explore panel's caps. A word page shows the
 * first section's best few, and every section in its Explore panel, a few rows each until asked
 * for more.
 */
export { CLOSEST_SYNONYMS, FREQUENT_WORDS, closestSynonyms, filterSynonymSections, sectionGlossLine, synonymCount, synonymsSearchable } from '@gokan/dataset-schema';

/** The Explore Synonyms panel: rows per group before "Show all" (the dictionary's too), and groups shown at a time. */
export { SYNONYM_GROUP_ROWS as GROUP_ROWS } from '@gokan/dataset-schema';
export const GROUPS_AT_ONCE = 4;

export type SynonymSection = SenseSynonyms<ListedSynonym>;

export interface SynonymLearner {
    /** The words the learner studies (learningQueue). */
    studied: ReadonlySet<string>;
    /** How often each other word was mixed up with this one, in either direction. */
    mixedUp: ReadonlyMap<string, number>;
}

/**
 * The shared sections, for this learner: a word they study is listed even outside the
 * FREQUENT_WORDS; words they mixed up with this one come first (the most often first), and words
 * they study right after the pairs set by hand.
 */
export function synonymSections(senses: readonly Pick<Sense, 'glosses' | 'misc'>[], synonyms: readonly ListedSynonym[], { studied, mixedUp }: SynonymLearner): SynonymSection[] {
    return senseSynonymSections(senses, synonyms, {
        keeps: synonym => studied.has(synonym.vocabId),
        lead: (x, y) => (mixedUp.get(y.vocabId) ?? 0) - (mixedUp.get(x.vocabId) ?? 0),
        afterCurated: (x, y) => Number(studied.has(y.vocabId)) - Number(studied.has(x.vocabId)),
    });
}

/**
 * The groups the panel lists: the first `limit`, plus any holding a word the learner mixed up
 * (the reason they came), in order; `hidden` is how many it leaves for "Show more meanings".
 */
export function shownGroups(sections: readonly SynonymSection[], limit: number, mixedUp: ReadonlyMap<string, number>): { shown: SynonymSection[]; hidden: number } {
    const shown = sections.filter((section, i) => i < limit || section.words.some(w => mixedUp.has(w.vocabId)));
    return { shown, hidden: sections.length - shown.length };
}
