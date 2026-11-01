import { isRareSense } from '@gokan/dataset-schema';
import type { Sense } from '@gokan/dataset-schema';
import type { ListedSynonym } from '../services/exercise/wordRelation';
import { normalizeGloss } from './synonymContext.utils';

/**
 * A word's synonyms as its page shows them: one section per sense, ordered so the
 * useful pairs come first, and capped. The pairs are not filtered by quality: their
 * noise comes from English homographs (強い "firm" lists 商会 "firm", a company), which
 * no threshold can see, so each pair sits under the sense it actually shares, where
 * the learner can see why it is there. A word page shows the first section's best few, and
 * every section in its Explore panel, a few rows each until asked for more.
 */

/** A word outside the most frequent this many is listed only when the learner studies it. */
export const FREQUENT_WORDS = 10_000;
/** A word page's Closest synonyms: this many from the first section. */
export const CLOSEST_SYNONYMS = 5;
/** The Explore Synonyms panel: rows per group before "Show all", and groups shown at a time. */
export const GROUP_ROWS = 3;
export const GROUPS_AT_ONCE = 4;

export interface SynonymSection {
    /** The sense's index in the word's senses. */
    sense: number;
    /** The sense's glosses, as printed: its label, and the text its pairs are read against. */
    glosses: string[];
    /** Every synonym listed under it, best first. */
    words: ListedSynonym[];
}

export interface SynonymLearner {
    /** The words the learner studies (learningQueue). */
    studied: ReadonlySet<string>;
    /** How often each other word was mixed up with this one, in either direction. */
    mixedUp: ReadonlyMap<string, number>;
}

/** How many of the pair's shared meanings this sense carries. */
function sharedIn(senseGlosses: ReadonlySet<string>, synonym: ListedSynonym): number {
    return synonym.shared.filter(g => senseGlosses.has(g)).length;
}

/**
 * One section per sense with a synonym. A synonym is listed once, under the sense it
 * shares the most meanings with (the earliest on a tie). A rare or archaic sense gets
 * no section, and a pair sharing only such a sense is not listed, unless every sense
 * is rare (婦人): the dataset pairs a word through the same senses. A pair set by hand
 * with no meaning in common goes under the first sense. A word outside the
 * FREQUENT_WORDS the learner does not study is left out.
 */
export function synonymSections(senses: readonly Pick<Sense, 'glosses' | 'misc'>[], synonyms: readonly ListedSynonym[], learner: SynonymLearner): SynonymSection[] {
    const allRare = senses.every(isRareSense);
    const shown = senses.flatMap((sense, index) => (isRareSense(sense) && !allRare ? [] : [{ index, sense, normalized: new Set(sense.glosses.map(normalizeGloss)) }]));
    if (shown.length === 0) return [];

    const placed = new Map<number, { synonym: ListedSynonym; shared: number }[]>();
    for (const synonym of synonyms) {
        const frequent = synonym.rank !== null && synonym.rank <= FREQUENT_WORDS;
        if (!frequent && !learner.studied.has(synonym.vocabId)) continue;
        let best = synonym.shared.length === 0 ? { index: shown[0].index, shared: 0 } : null;
        for (const { index, normalized } of shown) {
            const shared = sharedIn(normalized, synonym);
            if (shared > 0 && shared > (best?.shared ?? 0)) best = { index, shared };
        }
        if (!best) continue;
        placed.set(best.index, [...(placed.get(best.index) ?? []), { synonym, shared: best.shared }]);
    }

    return shown.flatMap(({ index, sense }) => {
        const entries = placed.get(index);
        if (!entries) return [];
        return [{ sense: index, glosses: sense.glosses, words: entries.sort((a, b) => compare(a, b, learner)).map(e => e.synonym) }];
    });
}

const TIER_ORDER = { interchangeable: 0, confusable: 1 } as const;

/**
 * Best first: words the learner mixed up with this one (the most often first), pairs
 * set by hand, words the learner studies, the most meanings shared in this sense,
 * interchangeable before confusable, then the most frequent.
 */
function compare(a: { synonym: ListedSynonym; shared: number }, b: { synonym: ListedSynonym; shared: number }, { studied, mixedUp }: SynonymLearner): number {
    const x = a.synonym, y = b.synonym;
    return (mixedUp.get(y.vocabId) ?? 0) - (mixedUp.get(x.vocabId) ?? 0)
        || Number(y.curated) - Number(x.curated)
        || Number(studied.has(y.vocabId)) - Number(studied.has(x.vocabId))
        || b.shared - a.shared
        || TIER_ORDER[x.tier] - TIER_ORDER[y.tier]
        || (x.rank ?? Infinity) - (y.rank ?? Infinity)
        || x.vocabId.localeCompare(y.vocabId);
}

/**
 * A word page's Closest synonyms: the first section's best words, up to CLOSEST_SYNONYMS, leaving
 * out a pair graded never accepted (`distinct`: a curated confusable pair is not a close word).
 * Null when nothing is left.
 */
export function closestSynonyms(sections: readonly SynonymSection[], isDistinct: (synonym: ListedSynonym, section: SynonymSection) => boolean): { section: SynonymSection; words: ListedSynonym[] } | null {
    const [first] = sections;
    if (!first) return null;
    const words = first.words.filter(w => !isDistinct(w, first)).slice(0, CLOSEST_SYNONYMS);
    return words.length > 0 ? { section: first, words } : null;
}

/** A section named in a line ("to get, to obtain"): its first two glosses, after the sense's number. */
export function sectionGlossLine(section: Pick<SynonymSection, 'glosses'>): string {
    return section.glosses.slice(0, 2).join(', ');
}

/** How many synonyms the sections list, each once. */
export function synonymCount(sections: readonly SynonymSection[]): number {
    return sections.reduce((n, s) => n + s.words.length, 0);
}

/** Only the words a search keeps, each section in place; a section left empty goes. */
export function filterSynonymSections(sections: readonly SynonymSection[], keep: (synonym: ListedSynonym) => boolean): SynonymSection[] {
    return sections.flatMap(section => {
        const words = section.words.filter(keep);
        return words.length > 0 ? [{ ...section, words }] : [];
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
