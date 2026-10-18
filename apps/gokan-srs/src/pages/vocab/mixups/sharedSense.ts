import type { Sense, Sentence } from '@gokan/dataset-schema';
import { normalizeGloss, sharedMeaningInCue } from '../../../utils/synonymContext.utils';
import { pickSentenceForVocab } from '../../../utils/sentenceRanking';
import type { LearnerVocab } from '../../../utils/sentenceRanking';
import { getCoarsePosLabels } from '../../quiz/quizFormatting';

/**
 * A word as one of its mix-up groups sees it: the sense the group shares, not the
 * whole entry. 差す is intransitive in the shine group (its "to shine" sense is vi),
 * though "to hold up an umbrella" makes the entry transitive too.
 */

const carries = (sense: Pick<Sense, 'glosses'>, meanings: readonly string[]) =>
    sense.glosses.some(g => meanings.includes(normalizeGloss(g)));

/** The senses carrying one of the meanings; every sense when none does (a "not a synonym" word). */
export function sensesSharing<T extends Pick<Sense, 'glosses'>>(senses: readonly T[], meanings: readonly string[]): T[] {
    const sharing = senses.filter(s => carries(s, meanings));
    return sharing.length > 0 ? sharing : [...senses];
}

/** The word type of those senses: the coarse labels, and a verb's transitivity when its senses have one. */
export function sharedSenseType(senses: readonly Sense[], meanings: readonly string[]): string[] {
    const sharing = sensesSharing(senses, meanings);
    const pos = new Set(sharing.flatMap(s => s.pos));
    const transitivity = pos.has('vi') && !pos.has('vt') ? ['intransitive'] : pos.has('vt') && !pos.has('vi') ? ['transitive'] : [];
    return [...getCoarsePosLabels(sharing), ...transitivity];
}

/** Every gloss, each marked when it is one of the meanings the group shares. */
export function markedGlosses(senses: readonly Pick<Sense, 'glosses'>[], meanings: readonly string[]): { gloss: string; shared: boolean }[] {
    const seen = new Set<string>();
    return senses.flatMap(s => s.glosses).flatMap(gloss => {
        if (seen.has(gloss)) return [];
        seen.add(gloss);
        return [{ gloss, shared: meanings.includes(normalizeGloss(gloss)) }];
    });
}

/**
 * The example to show: one whose English uses a meaning the group shares, matched as
 * grading matches a card's sentence (sharedMeaningInCue), ranked by the shared
 * sentence ranker. The dataset has no sense tags on sentences, so this is the proxy;
 * otherwise 差す would show 噂をすれば影がさす (its "appear" sense) in the shine group.
 * With no sentence using one, the ranker's usual pick.
 */
export function exampleForMeanings(vocabId: string, sentences: readonly Sentence[], meanings: readonly string[], learner: LearnerVocab): Sentence | null {
    const using = sentences.filter(s => sharedMeaningInCue([...meanings], { sentence: s.en[0]?.text ?? '' }));
    return pickSentenceForVocab(vocabId, using.length > 0 ? using : sentences, learner);
}
