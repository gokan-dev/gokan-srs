import type { Sentence } from '@gokan/dataset-schema';
import { emphasizeGloss } from './productionCloze.utils';
import { compareSentenceScores, scoreVocabSentence, type LearnerVocab } from './sentenceRanking';
import { hashString } from './deterministicPick';

/** How many examples a word page shows before Explore. */
export const PAGE_EXAMPLES = 2;

/**
 * The few sentences a word page shows above Explore: ones with an English line, those whose
 * English uses a word of the first sense first (the meaning the page leads with), then the
 * shared ranking (sentenceRanking.ts: fewest unknown words, then shortest), ties broken by a
 * hash seeded on the word, so the page shows the same two every visit.
 */
export function pickWordExamples(
    vocabId: string,
    sentences: readonly Sentence[],
    firstSenseGlosses: readonly string[],
    learner: LearnerVocab,
    count = PAGE_EXAMPLES,
): Sentence[] {
    const exclude = new Set([vocabId]);
    const glosses = [...firstSenseGlosses];
    return sentences
        .filter(s => s.en.length > 0)
        .map(sentence => ({
            sentence,
            usesFirstSense: emphasizeGloss(sentence.en[0].text, glosses).inline !== null,
            score: scoreVocabSentence(sentence, learner, exclude),
            tieBreak: hashString(`${vocabId}:${sentence.id}`),
        }))
        .sort((a, b) => Number(b.usesFirstSense) - Number(a.usesFirstSense)
            || compareSentenceScores(a.score, b.score)
            || a.tieBreak - b.tieBreak)
        .slice(0, count)
        .map(c => c.sentence);
}
