import type { Sentence, Vocabulary } from "@gokan/dataset-schema";

/** A word's pattern the Sentences panel is filtered on: its index in `Vocabulary.patterns`. */
export type PatternFilter = number | null;

/**
 * The word's sentences that hold one of its common patterns: those where an occurrence of the
 * word names it (`SentenceMatch.pattern`, set by the dataset), so none is parsed here.
 */
export function sentencesWithPattern(vocabId: string, sentences: readonly Sentence[], pattern: number): Sentence[] {
    return sentences.filter(s => s.matches?.[vocabId]?.some(m => m.pattern === pattern) ?? false);
}

/** The pattern's text, or null when the word has no such pattern (a filter left from another word). */
export function patternText(vocab: Pick<Vocabulary, 'patterns'>, pattern: PatternFilter): string | null {
    return pattern === null ? null : vocab.patterns?.[pattern]?.text ?? null;
}
