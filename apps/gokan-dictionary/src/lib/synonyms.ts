// A word page's synonyms (VocabPage.svelte): the sections the app's word page shows, from the
// shared `synonymSections` (@gokan/dataset-schema) with no learner layer, labelled by the shared
// `pairCloseness`, and cut to what the page ships. Built at render by lib/server/pages.ts.

import { closestSynonyms, headwordOf, pairCloseness, sectionGlossLine, synonymEntriesOf, synonymSections } from '@gokan/dataset-schema';
import type { Closeness, SynonymEntry, Vocabulary, WithSynonyms } from '@gokan/dataset-schema';

/**
 * What the page ships, at most: each meaning's best this many, and this many in all. 取る has 322
 * synonyms among the 10,000 most frequent words, the 99th percentile 69 and the 90th 23; a row is
 * about 110 bytes, so the cap holds the heaviest pages to about 4 KB of synonyms against the word
 * page's 20 KB budget (docs/MODIFICATION_LOG.md). The rest is counted, never dropped silently.
 */
export const SYNONYMS_PER_MEANING = 8;
export const SHIPPED_SYNONYMS = 32;
/** From 1024px, the Synonyms section's first meanings and rows; the rest under "Show N more". The app's full page shows the same. */
export const PREVIEW_MEANINGS = 2;
export const PREVIEW_ROWS = 3;

export interface SynonymRow {
    id: string;
    /** The headword (headwordOf): a word learned in kana by its kana. */
    word: string;
    /** The kana reading, only when it differs from the headword, as a word list row shows it. */
    reading?: string;
    /** The meanings the two words share, as the app's row shows them ("to shine, to gleam"): what a search reads. */
    shared: string;
    closeness: Closeness;
}

export interface SynonymGroup {
    /** The sense's number on the page (1 for the first). */
    number: number;
    /** Its first two glosses, the group's title ("to get, to obtain"). */
    glosses: string;
    words: SynonymRow[];
}

export interface WordSynonyms {
    /** Every group the page ships, best words first. */
    groups: SynonymGroup[];
    /** The Dict section's Closest synonyms: the first meaning's best, never a pair not interchangeable. */
    closest: SynonymGroup | null;
    /** How many synonyms the word has in all (after the frequent-word cut), and how many the page leaves out. */
    total: number;
    left: number;
}

function rowOf(entry: SynonymEntry, glosses: readonly string[]): SynonymRow {
    const word = headwordOf(entry.forms);
    const reading = entry.forms.reading.primary;
    return { id: entry.vocabId, word, ...(reading !== word ? { reading } : {}), shared: entry.shared.join(', '), closeness: pairCloseness(entry, glosses) };
}

/**
 * The word's synonyms, grouped by meaning as the app groups them, only the words `hasPage` says
 * the page can link (a page in another language links its own words only).
 */
export function wordSynonyms(vocab: Pick<Vocabulary, 'senses'> & WithSynonyms, hasPage: (id: string) => boolean): WordSynonyms {
    const sections = synonymSections(vocab.senses, synonymEntriesOf(vocab).filter(entry => hasPage(entry.vocabId)));
    const total = sections.reduce((n, section) => n + section.words.length, 0);
    let budget = SHIPPED_SYNONYMS;
    const groups = sections.flatMap(section => {
        const words = section.words.slice(0, Math.min(SYNONYMS_PER_MEANING, budget));
        budget -= words.length;
        return words.length > 0 ? [{ number: section.sense + 1, glosses: sectionGlossLine(section), words: words.map(word => rowOf(word, section.glosses)) }] : [];
    });
    const shipped = groups.reduce((n, group) => n + group.words.length, 0);
    const closest = closestSynonyms(sections, (word, section) => pairCloseness(word, section.glosses) === 'distinct');
    return {
        groups,
        closest: closest && { number: closest.section.sense + 1, glosses: sectionGlossLine(closest.section), words: closest.words.map(word => rowOf(word, closest.section.glosses)) },
        total,
        left: total - shipped,
    };
}
