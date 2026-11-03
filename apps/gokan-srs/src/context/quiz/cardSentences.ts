import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
import type { VocabProgress } from '../../models/vocabulary.model';
import { pickProductionClozeSentence } from '../../utils/productionCloze.utils';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import { pickSentenceForVocab } from '../../utils/sentenceRanking';
import type { LearnerVocab } from '../../utils/sentenceRanking';
import type { PendingQuizItem } from './quizReducer';

type CardItem = Pick<PendingQuizItem, 'quizType' | 'quizMode'>;

/**
 * Whether a word's card opens on its intro (it was never introduced): the one test both the
 * loading effect (which fetches the intro's sentence) and `selectNextView` (which shows the
 * intro) ask, so they never disagree on which card the word gets.
 */
export function awaitsIntro(queue: readonly VocabProgress[] | undefined, vocabId: string): boolean {
    return !queue?.find(v => v.vocabId === vocabId)?.introductionAt;
}

/**
 * Whether the card needs the word's sentences fetched before it renders: meaning in context and
 * production (whether a usable cloze exists depends on which sentences carry a match), and the
 * intro, which shows one example.
 */
export function needsSentences(item: CardItem, intro: boolean): boolean {
    return intro || isContextMeaning(item) || item.quizType === 'production';
}

function isContextMeaning(item: CardItem): boolean {
    return item.quizType === 'meaning' && item.quizMode === 'context';
}

export interface CardSentences {
    /** The meaning-in-context card's sentence. */
    sentence: Sentence | null;
    /** The production card's cloze; null falls back to the gloss prompt. */
    cloze: ProductionCloze | null;
    /** The intro card's example; null shows no sentence section. */
    introSentence: Sentence | null;
}

/**
 * Picks every sentence the word's card can show, once, when it loads. The intro reads the
 * production cloze's own picker (no second rule): the easiest sentence for this learner, with
 * the reading guard that drops a differently-read homograph's match (遊ぶ as すさぶ). The
 * ranker is deterministic for a learner state, so the intro usually shows the sentence the
 * production cloze later blanks: the learner meets the word in the context it is asked in.
 */
export function resolveCardSentences(
    vocabId: string,
    vocab: Vocabulary,
    item: CardItem,
    intro: boolean,
    sentences: readonly Sentence[] | null,
    learner: LearnerVocab,
): CardSentences {
    const none: CardSentences = { sentence: null, cloze: null, introSentence: null };
    if (!sentences || sentences.length === 0) return none;
    const list = [...sentences];
    // Pass the loaded vocab so the cloze guard rejects a sentence whose blanked span is a
    // differently-read homograph (see pickProductionClozeSentence).
    const clozeOf = () => pickProductionClozeSentence(vocabId, list, learner, vocab);

    const cloze = item.quizType === 'production' ? clozeOf() : null;
    // Only meaning in context shows a sentence: the intro's fetch must not give a base card one.
    const sentence = isContextMeaning(item) ? pickSentenceForVocab(vocabId, list, learner) ?? null : null;
    const introSentence = intro ? (cloze ?? clozeOf())?.sentence ?? null : null;
    return { sentence, cloze, introSentence };
}
