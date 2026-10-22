import type { Sense } from '@gokan/dataset-schema';
import type { ListedSynonym } from '../services/exercise/wordRelation';
import { isRareSense } from './senses.utils';
import { normalizeGloss } from './synonymContext.utils';

/**
 * A word's synonyms as its page shows them: one section per sense, ordered so the
 * useful pairs come first, and capped. The pairs are not filtered by quality: their
 * noise comes from English homographs (強い "firm" lists 商会 "firm", a company), which
 * no threshold can see, so each pair sits under the sense it actually shares, where
 * the learner can see why it is there. The caps are a starting point (issue #162).
 */

/** A word outside the most frequent this many is listed only when the learner studies it. */
export const FREQUENT_WORDS = 10_000;
/** Collapsed: the first sections, and words in each. */
export const COLLAPSED_SECTIONS = 3;
export const COLLAPSED_WORDS = 3;
/** Expanded: words in each section. */
export const EXPANDED_WORDS = 10;

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
 * no section, and a pair sharing only such a sense is not listed; a pair set by hand
 * with no meaning in common goes under the first sense. A word outside the
 * FREQUENT_WORDS the learner does not study is left out.
 */
export function synonymSections(senses: readonly Pick<Sense, 'glosses' | 'misc'>[], synonyms: readonly ListedSynonym[], learner: SynonymLearner): SynonymSection[] {
    const shown = senses.flatMap((sense, index) => (isRareSense(sense) ? [] : [{ index, sense, normalized: new Set(sense.glosses.map(normalizeGloss)) }]));
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

export interface ShownSection extends SynonymSection {
    /** The words listed in this view. */
    shown: ListedSynonym[];
    /** How many words of the section this view leaves out. */
    hidden: number;
}

/**
 * The sections a view lists. Collapsed: the first COLLAPSED_SECTIONS, COLLAPSED_WORDS
 * words each, plus any section holding a word the learner mixed up. Expanded: every
 * section, EXPANDED_WORDS words each.
 */
export function shownSections(sections: readonly SynonymSection[], expanded: boolean, mixedUp: ReadonlyMap<string, number>): ShownSection[] {
    const cap = expanded ? EXPANDED_WORDS : COLLAPSED_WORDS;
    return sections
        .filter((section, i) => expanded || i < COLLAPSED_SECTIONS || section.words.some(w => mixedUp.has(w.vocabId)))
        .map(section => ({ ...section, shown: section.words.slice(0, cap), hidden: Math.max(0, section.words.length - cap) }));
}

/** Whether expanding shows anything more than the collapsed view. */
export function hasMoreSynonyms(sections: readonly SynonymSection[], mixedUp: ReadonlyMap<string, number>): boolean {
    const collapsed = shownSections(sections, false, mixedUp);
    return collapsed.length < sections.length || collapsed.some(s => s.hidden > 0);
}
