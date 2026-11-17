import { isRareSense } from './senses';
import type { Sense, SynonymRelation, Vocabulary, VocabSynonym } from './vocabulary';

/**
 * A word's synonyms as a word page shows them, in both apps: one section per sense, ordered so the
 * useful pairs come first, and cut to the frequent words. The pairs are not filtered by quality:
 * their noise comes from English homographs (強い "firm" lists 商会 "firm", a company), which no
 * threshold can see, so each pair sits under the sense it actually shares, where the reader can see
 * why it is there. What a learner adds (the words they mixed up, the words they study) is a layer
 * the app lays on top (`SynonymLayer`); the dictionary lists them without one.
 */

/** A word outside the most frequent this many is listed only when a layer keeps it (the app: a word the learner studies). */
export const FREQUENT_WORDS = 10_000;
/** A word page's Closest synonyms: this many from the first section. */
export const CLOSEST_SYNONYMS = 5;

/**
 * The dataset's gloss normalization (gokan-dataset scripts/build-synonyms.ts), mirrored so a
 * printed gloss compares equal to the `shared` entries built from it: lowercase, parentheticals
 * and a leading "to"/article dropped, punctuation stripped.
 */
export function normalizeGloss(gloss: string): string {
    return gloss
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/^\s*(to|a|an|the)\s+/, '')
        .replace(/[.,;:!?"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Enough of the other word to name it (headwordOf, secondaryForm) without loading its file. */
export type SynonymForms = Pick<Vocabulary, 'writtenForm' | 'reading' | 'usuallyKana'>;

/** The other word's forms, from what the dataset embeds on the pair. */
export function synonymFormsOf(entry: Pick<VocabSynonym, 'w' | 'r' | 'u'>): SynonymForms {
    const { w, r } = entry;
    return {
        writtenForm: { kanji: w[0] ?? r[0], alternatives: w.slice(1), containedKanji: [] },
        reading: { primary: r[0], alternatives: r.slice(1) },
        // So a word learned in kana is named by its kana (headwordOf).
        ...(entry.u ? { usuallyKana: true as const } : {}),
    };
}

/** A word's synonym as a page lists it: the other word's forms, what they share, how frequent it is. */
export interface SynonymEntry {
    vocabId: string;
    forms: SynonymForms;
    /** The normalized meanings both words carry. */
    shared: string[];
    /** The other word's frequency rank (1 is the most frequent), or null when unranked. */
    rank: number | null;
    tier: SynonymRelation;
    curated: boolean;
}

/** Every synonym of the word, as a page lists them. */
export function synonymEntriesOf(vocab: Pick<Vocabulary, 'synonyms'>): SynonymEntry[] {
    return (vocab.synonyms ?? []).map(entry => ({
        vocabId: entry.id,
        forms: synonymFormsOf(entry),
        shared: entry.shared ?? [],
        rank: entry.f ?? null,
        tier: entry.relation,
        curated: entry.curated === true,
    }));
}

/** What sectioning reads of a synonym: the app's listed synonyms carry more. */
export type SectionedSynonym = Pick<SynonymEntry, 'vocabId' | 'shared' | 'rank' | 'tier' | 'curated'>;

/** The synonyms listed under one sense. */
export interface SenseSynonyms<T extends SectionedSynonym = SynonymEntry> {
    /** The sense's index in the word's senses. */
    sense: number;
    /** The sense's glosses, as printed: its label, and the text its pairs are read against. */
    glosses: string[];
    /** Every synonym listed under it, best first. */
    words: T[];
}

/**
 * What a reader adds to the listing (the app: a learner's mix-ups and studied words). `lead` orders
 * ahead of everything, `afterCurated` just after the pairs set by hand; `keeps` lists a word outside
 * the FREQUENT_WORDS.
 */
export interface SynonymLayer<T> {
    keeps: (synonym: T) => boolean;
    lead: (a: T, b: T) => number;
    afterCurated: (a: T, b: T) => number;
}

const NO_LAYER: SynonymLayer<unknown> = { keeps: () => false, lead: () => 0, afterCurated: () => 0 };

/** How many of the pair's shared meanings this sense carries. */
function sharedIn(senseGlosses: ReadonlySet<string>, synonym: SectionedSynonym): number {
    return synonym.shared.filter(g => senseGlosses.has(g)).length;
}

const TIER_ORDER = { interchangeable: 0, confusable: 1 } as const;

/**
 * One section per sense with a synonym. A synonym is listed once, under the sense it shares the
 * most meanings with (the earliest on a tie). A rare or archaic sense gets no section, and a pair
 * sharing only such a sense is not listed, unless every sense is rare (婦人): the dataset pairs a
 * word through the same senses. A pair set by hand with no meaning in common goes under the first
 * sense. A word outside the FREQUENT_WORDS is left out unless the layer keeps it.
 *
 * Best first: the layer's lead, pairs set by hand, the layer's next rule, the most meanings shared
 * in this sense, interchangeable before confusable, then the most frequent.
 */
export function synonymSections<T extends SectionedSynonym>(
    senses: readonly Pick<Sense, 'glosses' | 'misc'>[],
    synonyms: readonly T[],
    layer: SynonymLayer<T> = NO_LAYER,
): SenseSynonyms<T>[] {
    const allRare = senses.every(isRareSense);
    const shown = senses.flatMap((sense, index) => (isRareSense(sense) && !allRare ? [] : [{ index, sense, normalized: new Set(sense.glosses.map(normalizeGloss)) }]));
    if (shown.length === 0) return [];

    const placed = new Map<number, { synonym: T; shared: number }[]>();
    for (const synonym of synonyms) {
        const frequent = synonym.rank !== null && synonym.rank <= FREQUENT_WORDS;
        if (!frequent && !layer.keeps(synonym)) continue;
        let best = synonym.shared.length === 0 ? { index: shown[0].index, shared: 0 } : null;
        for (const { index, normalized } of shown) {
            const shared = sharedIn(normalized, synonym);
            if (shared > 0 && shared > (best?.shared ?? 0)) best = { index, shared };
        }
        if (!best) continue;
        placed.set(best.index, [...(placed.get(best.index) ?? []), { synonym, shared: best.shared }]);
    }

    const compare = (a: { synonym: T; shared: number }, b: { synonym: T; shared: number }): number => {
        const x = a.synonym, y = b.synonym;
        return layer.lead(x, y)
            || Number(y.curated) - Number(x.curated)
            || layer.afterCurated(x, y)
            || b.shared - a.shared
            || TIER_ORDER[x.tier] - TIER_ORDER[y.tier]
            || (x.rank ?? Infinity) - (y.rank ?? Infinity)
            || x.vocabId.localeCompare(y.vocabId);
    };

    return shown.flatMap(({ index, sense }) => {
        const entries = placed.get(index);
        if (!entries) return [];
        return [{ sense: index, glosses: sense.glosses, words: entries.sort(compare).map(e => e.synonym) }];
    });
}

/**
 * A word page's Closest synonyms: the first section's best words, up to CLOSEST_SYNONYMS, leaving
 * out a pair never accepted (`isDistinct`: a curated confusable pair is not a close word). Null
 * when nothing is left.
 */
export function closestSynonyms<T extends SectionedSynonym>(sections: readonly SenseSynonyms<T>[], isDistinct: (synonym: T, section: SenseSynonyms<T>) => boolean): { section: SenseSynonyms<T>; words: T[] } | null {
    const [first] = sections;
    if (!first) return null;
    const words = first.words.filter(w => !isDistinct(w, first)).slice(0, CLOSEST_SYNONYMS);
    return words.length > 0 ? { section: first, words } : null;
}

/** A section named in a line ("to get, to obtain"): its first two glosses, after the sense's number. */
export function sectionGlossLine(section: Pick<SenseSynonyms, 'glosses'>): string {
    return section.glosses.slice(0, 2).join(', ');
}

/** How many synonyms the sections list, each once. */
export function synonymCount(sections: readonly Pick<SenseSynonyms<SectionedSynonym>, 'words'>[]): number {
    return sections.reduce((n, s) => n + s.words.length, 0);
}

/** Only the words a search keeps, each section in place; a section left empty goes. */
export function filterSynonymSections<T extends SectionedSynonym>(sections: readonly SenseSynonyms<T>[], keep: (synonym: T) => boolean): SenseSynonyms<T>[] {
    return sections.flatMap(section => {
        const words = section.words.filter(keep);
        return words.length > 0 ? [{ ...section, words }] : [];
    });
}

/** How close two words are, as a word page labels the pair. */
export type Closeness = 'interchangeable' | 'close' | 'distinct';

/**
 * The pair's label, read in the sense the page lists it under: a pair set by hand as confusable is
 * never interchangeable (必ず / 常に); an interchangeable pair is; any other is close in a sense it
 * shares and not interchangeable in one it does not. This is what gokan-srs's grading table
 * (services/exercise/wordRelation.ts, `closenessOf`) gives a card printing the sense's glosses, and
 * a test there holds the two equal on every kind of pair.
 */
export function pairCloseness(pair: Pick<SectionedSynonym, 'tier' | 'curated' | 'shared'>, senseGlosses: readonly string[]): Closeness {
    if (pair.curated && pair.tier === 'confusable') return 'distinct';
    if (pair.tier === 'interchangeable') return 'interchangeable';
    const printed = new Set(senseGlosses.map(normalizeGloss));
    return pair.shared.some(g => printed.has(g)) ? 'close' : 'distinct';
}

/** Each label is told apart by its sign and its word, never by a colour (docs/DESIGN_SYSTEM.md), in both apps. */
export const CLOSENESS_LABEL: Record<Closeness, { sign: string; label: string }> = {
    interchangeable: { sign: '=', label: 'Interchangeable' },
    close: { sign: '≈', label: 'Close in this sense' },
    distinct: { sign: '≠', label: 'Not interchangeable' },
};
