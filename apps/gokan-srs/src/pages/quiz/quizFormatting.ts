import { useState } from 'react';
import type { Sense } from '../../models/vocabulary.model';

/** "primary, alt1, alt2" - shared by the intro card and reading quiz's correct-answer reveal. */
export function formatReadingList(reading: { primary: string; alternatives: string[] }): string {
    return [reading.primary, ...reading.alternatives].join(', ');
}

/** Deduped part-of-speech tags across all senses, optionally including misc/register tags. */
export function getUniquePosTags(senses: Sense[], includeMiscTags = false): string[] {
    return Array.from(new Set(
        senses.flatMap(sense => includeMiscTags
            ? [...sense.pos, ...(sense.misc?.rawTags ?? [])]
            : sense.pos)
    ));
}

/**
 * A single plain-English word-type label for one JMdict POS code, coarser than
 * `TagsLookup`'s full grammatical description ("Ichidan verb", "noun (common)
 * (futsuumeishi)"). On the production cards the learner is producing the word, so
 * the useful cue is "verb vs noun vs adjective", not the conjugation class - a
 * word whose gloss reads "strong" could be an adjective or a verb, and that alone
 * often decides which word to give. Returns null for codes with no useful plain
 * label (they are simply omitted rather than shown as jargon).
 */
export function coarsePosLabel(code: string): string | null {
    if (code.startsWith('v')) return 'verb';           // v1, v5*, vk, vs-*, vt, vi, ...
    if (code.startsWith('adj')) return 'adjective';    // adj-i, adj-na, adj-no, adj-pn, ...
    if (code === 'adv' || code === 'adv-to') return 'adverb';
    if (code === 'n' || code.startsWith('n-')) return 'noun';
    if (code === 'pn') return 'pronoun';
    if (code === 'exp') return 'expression';
    if (code === 'int') return 'interjection';
    if (code === 'conj') return 'conjunction';
    if (code === 'ctr') return 'counter';
    if (code === 'num') return 'number';
    if (code === 'pref') return 'prefix';
    if (code === 'suf') return 'suffix';
    if (code === 'prt') return 'particle';
    return null;
}

/**
 * Deduped coarse word-type labels across all senses, in a stable priority order
 * (verb, adjective, adverb, noun, then anything else as encountered). Usually one
 * label, occasionally two (e.g. a suru-noun is both "verb" and "noun"). Shown on
 * both production cards as the "what type of word am I producing" cue.
 */
export function getCoarsePosLabels(senses: Sense[]): string[] {
    const labels = new Set<string>();
    for (const sense of senses) {
        for (const code of sense.pos) {
            const label = coarsePosLabel(code);
            if (label) labels.add(label);
        }
    }
    const priority = ['verb', 'adjective', 'adverb', 'noun'];
    const rank = (l: string) => {
        const i = priority.indexOf(l);
        return i === -1 ? priority.length : i;
    };
    return Array.from(labels).sort((a, b) => rank(a) - rank(b));
}

/** Deduped related compounds across all senses. */
export function getUniqueRelatedCompounds(senses: Sense[]): string[] {
    return Array.from(new Set(senses.flatMap(sense => sense.related?.compounds ?? [])));
}

/** Shared "+N more definitions" expand/collapse behavior for quiz cards. */
export function useExpandableDefinitions(senses: Sense[], maxDefs: number) {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMoreDefs = senses.length > maxDefs;
    const displayedSenses = isExpanded ? senses : senses.slice(0, maxDefs);
    return { displayedSenses, hasMoreDefs, isExpanded, toggleExpanded: () => setIsExpanded(v => !v) };
}
