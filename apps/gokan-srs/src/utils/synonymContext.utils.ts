import type { Sense } from '@gokan/dataset-schema';
import type { ProductionCloze } from './productionCloze.utils';

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
 * The lines the gloss-prompt card prints, each a list of glosses: every gloss of the
 * first sense, then the leading gloss of each of the next three senses. A single gloss
 * is often too thin a clue to produce a specific word from, and every sense is too
 * much to read mid-session. The card renders these lines and grading reads them, so
 * grading reads exactly what the learner was shown.
 */
export function glossPromptLines(senses: Pick<Sense, 'glosses'>[]): string[][] {
    const [first, ...rest] = senses;
    return [first?.glosses ?? [], ...rest.slice(0, 3).map(s => s.glosses.slice(0, 1))].filter(line => line.length > 0);
}

export function productionCueOf(senses: Pick<Sense, 'glosses'>[], cloze: ProductionCloze | null): ProductionCue {
    if (cloze) return { sentence: cloze.sentence.en[0]?.text ?? '' };
    return { glosses: glossPromptLines(senses).flat() };
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

/** A word of an English text, lowercased, with where it sits in the original text. */
interface Token { word: string; start: number; end: number }

const tokenize = (text: string): Token[] =>
    [...text.matchAll(/[a-z0-9]+(?:[-'][a-z0-9]+)*/gi)].map(m => ({ word: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));

/** Inflected English forms a gloss word may take in a sentence (think: thinks, thinking). */
function englishForms(word: string): Set<string> {
    const forms = new Set([word, word + 's', word + 'es', word + 'ed', word + 'd', word + 'ing']);
    if (word.endsWith('e')) forms.add(word.slice(0, -1) + 'ing');
    if (word.endsWith('y')) { forms.add(word.slice(0, -1) + 'ies'); forms.add(word.slice(0, -1) + 'ied'); }
    return forms;
}

/**
 * Where the sentence uses this gloss as a whole word or phrase, or null. Any word may
 * be inflected: the head of a verb phrase is usually first ("lined up" for "line up").
 */
function glossSpan(tokens: Token[], gloss: string): { start: number; end: number } | null {
    const words = tokenize(gloss).map(t => englishForms(t.word));
    if (words.length === 0) return null;
    for (let i = 0; i + words.length <= tokens.length; i++) {
        if (words.every((forms, j) => forms.has(tokens[i + j].word))) return { start: tokens[i].start, end: tokens[i + words.length - 1].end };
    }
    return null;
}

/**
 * Where an English sentence uses a gloss, matched exactly as grading matches a shared
 * meaning against a cloze card's sentence: the card bolds what grading reads.
 */
export function glossSpanIn(sentence: string, gloss: string): { start: number; end: number } | null {
    return glossSpan(tokenize(sentence), normalizeGloss(gloss));
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
        if (shared.some(g => glossSpan(tokens, g) !== null)) return true;
    }
    return false;
}
