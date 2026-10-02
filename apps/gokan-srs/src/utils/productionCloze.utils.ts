import type { Sentence } from '../models/sentence.model';
import type { LearnerVocab } from './sentenceRanking';
import { pickSentenceForVocab } from './sentenceRanking';

/**
 * A single sentence chosen to drive the production cloze card (issue #72): the
 * target word's span within `sentence.original`, straight from the dataset's
 * `matches[vocabId]` - no tokenization needed, unlike the grammar activity's
 * word-by-word blanking (`computeBlankPlan`), since a vocab sentence only needs
 * one span blanked.
 */
export interface ProductionCloze {
    sentence: Sentence;
    blankStart: number;
    blankLength: number;
    /**
     * The blanked span's own reading, conjugation included (たべたら for the 食べたら
     * span), from the same `matches` entry. Absent on data without one.
     */
    blankReading?: string;
}

/** The blanked text itself (食べたら): the form the sentence actually uses. */
export function blankSurfaceOf(cloze: ProductionCloze): string {
    return cloze.sentence.original.slice(cloze.blankStart, cloze.blankStart + cloze.blankLength);
}

/** The blank's surface and reading, the extra forms production grading accepts for a cloze card. */
export function clozeAcceptedForms(cloze: ProductionCloze | null): string[] {
    if (!cloze) return [];
    return [blankSurfaceOf(cloze), ...(cloze.blankReading ? [cloze.blankReading] : [])];
}

/**
 * Picks the sentence (and blank span within it) to drive this turn's production
 * cloze card, restricted to sentences carrying a usable `matches[vocabId]` entry
 * - a sentence with no match for this word cannot be blanked. When the word
 * appears more than once in the same sentence, the first occurrence is blanked;
 * "exactly one vocab word blanked" means one blank, not necessarily the only
 * occurrence of its surface form.
 *
 * Among usable sentences, the shared ranker (sentenceRanking.ts) picks the one
 * built most from words the learner is currently learning, the same rule the
 * grammar review uses. The word being tested is left out of the scoring, since
 * every candidate contains it. The pick is seeded on the vocab id alone, so the
 * same sentence keeps coming back until its surrounding words mature.
 *
 * Returns null when no sentence has a usable match - the caller reads that as
 * "fall back to the gloss-prompt card" (VocabProductionQuizCard). Coverage is
 * inherently partial: not every vocab has sentences, and not every sentence a
 * word appears in was tokenized with a resolved match for it.
 */
export function pickProductionClozeSentence(
    vocabId: string,
    sentences: Sentence[],
    learner: LearnerVocab
): ProductionCloze | null {
    const usable = sentences.filter(s => (s.matches?.[vocabId]?.length ?? 0) > 0);
    const sentence = pickSentenceForVocab(vocabId, usable, learner);
    if (!sentence) return null;
    const match = sentence.matches![vocabId][0];

    return {
        sentence,
        blankStart: match.start,
        blankLength: match.length,
        ...(match.reading ? { blankReading: match.reading } : {}),
    };
}

/**
 * Splits a cloze's sentence into the literal text before/after the blanked span.
 * `before + blank + after` always reproduces `sentence.original` exactly - the
 * same invariant gokan-dictionary's `segmentSentence` relies on for the same
 * `matches` data (see that app's `sentenceSegments.ts`).
 */
export function splitSentenceAtBlank(cloze: ProductionCloze): { before: string; blank: string; after: string } {
    const { sentence, blankStart, blankLength } = cloze;
    return {
        before: sentence.original.slice(0, blankStart),
        blank: sentence.original.slice(blankStart, blankStart + blankLength),
        after: sentence.original.slice(blankStart + blankLength),
    };
}

/**
 * Splits a cloze into the two `Sentence` fragments on either side of the blank,
 * so the cloze card can render its surrounding context through the shared
 * `InteractiveSentence` component (clickable, gloss-on-hover words) instead of
 * flat text - the same treatment every other sentence in the app gets.
 *
 * Each fragment carries only the vocab matches that fall ENTIRELY on its side,
 * with `after`'s offsets rebased to its own slice. The blanked target span is
 * carried into neither fragment, so the target word is never rendered (it stays
 * the input) - even when the word occurs elsewhere in the sentence, only the
 * blanked occurrence is dropped. A match that straddles the blank boundary is
 * dropped defensively (matches should never overlap the target span, but a bad
 * datum must not render half a word next to the blank).
 */
/**
 * Best-effort emphasis for the production cloze card's English cue: which word in
 * the English translation corresponds to the blanked Japanese word. The bare cue
 * was too ambiguous to tell which of a long sentence's words to produce.
 *
 * There is no word-level JP<->EN alignment in the dataset, so this matches the
 * target vocab's own glosses against the translation: the most specific (longest)
 * gloss that appears as a whole word wins, and its span in the ORIGINAL text is
 * returned for in-place bolding. Conjugated or reworded translations often carry
 * no verbatim gloss ("has" for the gloss "to have"), so when nothing matches
 * `inline` is null and `labelGlosses` carries a few cleaned glosses for the
 * caller to show as an explicit label instead - so every card indicates the
 * word one way or the other (the chosen "bold gloss + label fallback" behaviour).
 */
export interface GlossEmphasis {
    inline: { before: string; match: string; after: string } | null;
    /** Cleaned glosses to show as a label when `inline` is null; empty otherwise. */
    labelGlosses: string[];
}

function cleanGloss(gloss: string): string {
    return gloss
        .replace(/\s*\([^)]*\)/g, '')          // drop parentheticals: "to hold (in hand)" -> "to hold"
        .replace(/^(?:to|a|an|the)\s+/i, '')    // drop a leading article / infinitive "to"
        .trim();
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function emphasizeGloss(englishText: string, glosses: string[]): GlossEmphasis {
    const cleaned = [...new Set(glosses.map(cleanGloss).filter(g => g.length > 0))];

    // Inline match: try the most specific glosses first, require >= 3 chars so an
    // incidental "be"/"do" is never bolded, and match on a word boundary.
    const candidates = cleaned.filter(g => g.length >= 3).sort((a, b) => b.length - a.length);
    for (const cand of candidates) {
        const m = new RegExp(`\\b${escapeRegExp(cand)}\\b`, 'i').exec(englishText);
        if (m) {
            return {
                inline: {
                    before: englishText.slice(0, m.index),
                    match: englishText.slice(m.index, m.index + m[0].length),
                    after: englishText.slice(m.index + m[0].length),
                },
                labelGlosses: [],
            };
        }
    }

    return { inline: null, labelGlosses: cleaned.slice(0, 3) };
}

export function splitClozeContext(cloze: ProductionCloze): { before: Sentence; after: Sentence } {
    const { sentence, blankStart, blankLength } = cloze;
    const blankEnd = blankStart + blankLength;

    type Match = { start: number; length: number; reading?: string };
    const beforeMatches: Record<string, Match[]> = {};
    const afterMatches: Record<string, Match[]> = {};

    for (const [vocabId, arr] of Object.entries(sentence.matches ?? {})) {
        for (const m of arr) {
            if (m.start + m.length <= blankStart) {
                (beforeMatches[vocabId] ??= []).push({ ...m });
            } else if (m.start >= blankEnd) {
                (afterMatches[vocabId] ??= []).push({ start: m.start - blankEnd, length: m.length, reading: m.reading });
            }
            // else: overlaps the blank -> dropped
        }
    }

    return {
        before: {
            ...sentence,
            id: `${sentence.id}:before`,
            original: sentence.original.slice(0, blankStart),
            vocabIds: Object.keys(beforeMatches),
            matches: beforeMatches,
        },
        after: {
            ...sentence,
            id: `${sentence.id}:after`,
            original: sentence.original.slice(blankEnd),
            vocabIds: Object.keys(afterMatches),
            matches: afterMatches,
        },
    };
}
