// src/services/exercise/wordRelation.ts
//
// The one reader of the dataset's synonym pairs (VocabSynonym, Vocabulary.synonyms:
// enforced by check:conventions). A pair is two words sharing at least one meaning;
// its tier says how close they are out of context. Grading, effects, the cards, the
// ticker, the mix-up records and the pages that show a pair all read it through
// here, so the tier a page shows is the tier grading uses.
import type { SynonymRelation, Vocabulary, VocabSynonym } from '@gokan/dataset-schema';
import type { AnswerResult } from '../../utils/answerMatching';
import { sharedMeaningInCue } from '../../utils/synonymContext.utils';
import type { ProductionCue } from '../../utils/synonymContext.utils';
import type { PairRelation } from '../../utils/mixupGroups.utils';
import type { SynonymCandidate } from './types';

/** A pair as the dataset states it: what `relationOf` reads. */
export type WordPair = Pick<SynonymCandidate, 'relation' | 'shared' | 'curated'>;

/** A pair, read against the text in front of the learner. */
export interface WordRelation {
    /** Out-of-context tier: computed by the dataset build, or set by hand. */
    tier: SynonymRelation;
    /** The tier was set by hand (data/raw/vocab/synonyms.json in gokan-dataset). */
    curated: boolean;
    /** The normalized meanings both words carry. */
    shared: string[];
    /** The shared meaning the cue uses, or null when it uses none (out of context). */
    meaning: string | null;
}

export function relationOf(pair: WordPair, cue: ProductionCue): WordRelation {
    const shared = pair.shared ?? [];
    return {
        tier: pair.relation,
        curated: pair.curated === true,
        shared,
        meaning: shared.find(g => sharedMeaningInCue([g], cue)) ?? null,
    };
}

/** What a synonym typed instead of the asked word earns. `confusable` is neutral. */
export type SynonymOutcome = 'correct' | 'minor_error' | 'confusable';

/**
 * The one table of what a pair earns:
 *
 * | Pair                              | Shared meaning in the card? | Earns       |
 * |-----------------------------------|-----------------------------|-------------|
 * | curated confusable                | either                      | neutral     |
 * | any other                         | yes                         | correct     |
 * | interchangeable (auto or curated) | no                          | minor_error |
 * | confusable (auto)                 | no                          | neutral     |
 *
 * Lenient on purpose: a quiz that punishes a right answer is worse than one that
 * accepts a near one. A reported false positive is corrected by curating the pair in
 * the dataset (止む / 埋める), never by making this table stricter. The out-of-context
 * auto tier was switched off once (2026-10-03) and restored (issue #150): see
 * docs/MODIFICATION_LOG.md.
 */
export function outcomeOf(relation: WordRelation): SynonymOutcome {
    if (relation.curated && relation.tier === 'confusable') return 'confusable';
    if (relation.meaning !== null) return 'correct';
    return relation.tier === 'interchangeable' ? 'minor_error' : 'confusable';
}

/** How an outcome reads everywhere: the slot, the effects, the card and the ticker. */
export interface OutcomeLook {
    /** The slot's result. A neutral outcome reads as a miss, but is left out of the exercise's result. */
    result: AnswerResult;
    /** No credit, no penalty: left out of the result, the asked item retried, drawn muted. */
    neutral: boolean;
    /** The typed word earns indirect credit. */
    creditsTyped: boolean;
    /** Answers the card, short of the word asked: drawn as accepted, never as wrong. */
    accepted: boolean;
}

export const OUTCOME_LOOK: Record<SynonymOutcome, OutcomeLook> = {
    correct: { result: 'correct', neutral: false, creditsTyped: true, accepted: true },
    minor_error: { result: 'minor_error', neutral: false, creditsTyped: true, accepted: true },
    confusable: { result: 'wrong', neutral: true, creditsTyped: false, accepted: false },
};

/** The feedback naming the word typed and the word asked. */
export function synonymNote(outcome: SynonymOutcome, typed: string, tested: string, meaning: string | null): string {
    switch (outcome) {
        case 'correct': return `${typed} also means "${meaning ?? ''}" here. The word being tested was ${tested}.`;
        case 'minor_error': return `${typed} is also accepted here - the word being tested was ${tested}.`;
        case 'confusable': return `${typed} is a close synonym but not interchangeable here - the word being tested was ${tested}.`;
    }
}

/**
 * A grading candidate built from the forms the dataset embeds on the entry, so
 * matching a wrong answer against hundreds of pairs needs no vocab-file fetch.
 */
function candidateOf(entry: VocabSynonym): SynonymCandidate {
    const { w, r, pos } = entry;
    return {
        vocabId: entry.id,
        relation: entry.relation,
        shared: entry.shared,
        curated: entry.curated,
        vocab: {
            writtenForm: { kanji: w[0] ?? r[0], alternatives: w.slice(1), containedKanji: [] },
            reading: { primary: r[0], alternatives: r.slice(1) },
            // Only pos is read, by the inflection generator (wordClassesOf).
            senses: pos ? [{ pos, glosses: [], misc: { rawTags: [] }, related: { compounds: [] } }] : [],
            // So the feedback names a word learned in kana by its kana (headwordOf).
            ...(entry.u ? { usuallyKana: true as const } : {}),
        },
    };
}

/** The word's near-synonyms as grading candidates, from the forms the dataset embeds on each entry. */
export function synonymsOf(vocab: Pick<Vocabulary, 'synonyms'>): SynonymCandidate[] {
    return (vocab.synonyms ?? []).map(candidateOf);
}

/** The pair a word forms with another, when the dataset has one. */
export function pairWith(vocab: Pick<Vocabulary, 'synonyms'>, otherId: string): WordPair | null {
    return vocab.synonyms?.find(s => s.id === otherId) ?? null;
}

/**
 * The pair a word asked forms with the word typed, as a page shows it: relationOf out
 * of any cue, so the tier on the page is the tier grading uses. Undefined while the
 * asked word is not loaded; null when the dataset has no such pair ("not a synonym").
 */
export function pairRelation(asked: Pick<Vocabulary, 'synonyms'> | undefined, typed: string): PairRelation | null | undefined {
    if (!asked) return undefined;
    const pair = pairWith(asked, typed);
    if (!pair) return null;
    const { tier, curated, shared } = relationOf(pair, {});
    return { tier, curated, shared };
}

/** Entries whose shared meaning the cue uses come first, so when an answer is only a typo of several of them, the one this card means wins. */
export function orderSynonymsForCue<T extends WordPair>(entries: T[], cue: ProductionCue): T[] {
    const inCue = entries.filter(e => relationOf(e, cue).meaning !== null);
    return [...inCue, ...entries.filter(e => !inCue.includes(e))];
}
