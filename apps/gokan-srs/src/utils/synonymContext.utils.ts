import type { Sense } from '../models/vocabulary.model';
import type { VocabSynonym } from '../models/index.model';
import type { ProductionCloze } from './productionCloze.utils';
import type { ProductionSynonymCandidate } from '../services/srs.service';

/**
 * The text a production card puts in front of the learner, which is what decides
 * whether a near-synonym answers it. A word is a synonym of another only in a given
 * sense: 狭い and 小さい share just "small", so 小さい answers 狭い in "Japan is a
 * small country" but not in a sentence about a narrow street.
 */
export interface ProductionCue {
    /** The cloze card's English sentence. */
    sentence?: string;
    /** The gloss card's printed glosses. */
    glosses?: string[];
}

/**
 * The glosses the gloss-prompt card prints: every gloss of the first sense, then
 * the leading gloss of each of the next three senses. Shared with the card itself
 * so grading reads exactly what the learner was shown.
 */
export function glossPromptGlosses(senses: Pick<Sense, 'glosses'>[]): string[] {
    const [first, ...rest] = senses;
    return [...(first?.glosses ?? []), ...rest.slice(0, 3).map(s => s.glosses[0]).filter(Boolean)];
}

export function productionCueOf(senses: Pick<Sense, 'glosses'>[], cloze: ProductionCloze | null): ProductionCue {
    if (cloze) return { sentence: cloze.sentence.en[0]?.text ?? '' };
    return { glosses: glossPromptGlosses(senses) };
}

/**
 * The dataset's gloss normalization (gokan-dataset scripts/build-synonyms.ts),
 * mirrored so a printed gloss compares equal to the `shared` entries built from it:
 * lowercase, parentheticals and a leading "to"/article dropped, punctuation stripped.
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

const tokenize = (text: string) => text.toLowerCase().match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) ?? [];

/** Inflected English forms a gloss word may take in a sentence (think: thinks, thinking). */
function englishForms(word: string): Set<string> {
    const forms = new Set([word, word + 's', word + 'es', word + 'ed', word + 'd', word + 'ing']);
    if (word.endsWith('e')) forms.add(word.slice(0, -1) + 'ing');
    if (word.endsWith('y')) { forms.add(word.slice(0, -1) + 'ies'); forms.add(word.slice(0, -1) + 'ied'); }
    return forms;
}

/**
 * Does the sentence use this gloss as a whole word or phrase? Any word may be
 * inflected: the head of a verb phrase is usually first ("lined up" for "line up").
 */
function sentenceUses(tokens: string[], gloss: string): boolean {
    const words = tokenize(gloss).map(englishForms);
    if (words.length === 0) return false;
    for (let i = 0; i + words.length <= tokens.length; i++) {
        if (words.every((forms, j) => forms.has(tokens[i + j]))) return true;
    }
    return false;
}

/** True when the card's text uses one of the meanings the two words share. */
export function sharedMeaningInCue(shared: string[], cue: ProductionCue): boolean {
    if (shared.length === 0) return false;
    if (cue.glosses) {
        const printed = new Set(cue.glosses.map(normalizeGloss));
        if (shared.some(g => printed.has(g))) return true;
    }
    if (cue.sentence) {
        const tokens = tokenize(cue.sentence);
        if (shared.some(g => sentenceUses(tokens, g))) return true;
    }
    return false;
}

/** The shared gloss the cue uses, for the feedback message. */
export function sharedMeaningUsed(shared: string[], cue: ProductionCue): string | null {
    return shared.find(g => sharedMeaningInCue([g], cue)) ?? null;
}

export type SynonymOutcome = 'correct' | 'minor_error' | 'confusable';

/**
 * What a near-synonym answer earns:
 * - in context (the card uses a shared meaning): `correct`, still flagged as a synonym;
 * - otherwise its build-time tier: `interchangeable` is a `minor_error`,
 *   `confusable` is no credit and no penalty.
 * A curated `confusable` pair (必ず / 常に) is never upgraded by context: it was
 * hand-marked as not interchangeable even though the words share a gloss.
 */
export function synonymOutcome(entry: Pick<VocabSynonym, 'relation' | 'shared' | 'curated'>, cue: ProductionCue): SynonymOutcome {
    const curatedConfusable = entry.curated && entry.relation === 'confusable';
    if (!curatedConfusable && sharedMeaningInCue(entry.shared ?? [], cue)) return 'correct';
    return entry.relation === 'interchangeable' ? 'minor_error' : 'confusable';
}

/**
 * A grading candidate built from the forms the dataset embeds on the entry, so
 * matching a wrong answer against hundreds of pairs needs no vocab-file fetch.
 * Null for an entry without them (data built before they existed, or a
 * hand-added pair the scan skipped): the caller fetches those instead.
 */
export function embeddedSynonymCandidate(entry: VocabSynonym): ProductionSynonymCandidate | null {
    const { w = [], r = [], pos } = entry;
    if (r.length === 0) return null;
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
        },
    };
}

/** Entries whose shared meaning the cue uses come first, so a lazy lookup usually stops early. */
export function orderSynonymsForCue<T extends { shared?: string[] }>(entries: T[], cue: ProductionCue): T[] {
    const inCue = entries.filter(e => sharedMeaningInCue(e.shared ?? [], cue));
    return [...inCue, ...entries.filter(e => !inCue.includes(e))];
}
