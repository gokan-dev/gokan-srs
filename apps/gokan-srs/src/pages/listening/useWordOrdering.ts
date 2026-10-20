import { useMemo } from "react";
import { VocabularyService } from "../../services/vocabulary.service";
import { useQuiz } from "../../context/useQuiz";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { KanjiLearningMethod } from "../../models/user.model";
import { CONSTANTS } from "../../commons/constants";
import { buildWordOrderContext, kanjiCoverageScoresFor } from "../../utils/wordOrder.utils";
import type { LearnerOrder, WordOrderContext } from "../../utils/wordOrder.utils";

/** Built once per kanji method and page load: the indexes behind it are themselves cached by VocabularyService. */
const cachedContexts = new Map<KanjiLearningMethod, WordOrderContext>();

async function loadContext(method: KanjiLearningMethod): Promise<WordOrderContext | null> {
    const cached = cachedContexts.get(method);
    if (cached) return cached;
    const [frequency, jlpt, kanjiSteps] = await Promise.all([
        VocabularyService.loadFrequencyIndex(),
        VocabularyService.loadJlptIndex(),
        VocabularyService.loadKanjiStepIndex(method),
    ]);
    if (!frequency || !jlpt || !kanjiSteps) return null;
    const context = buildWordOrderContext(frequency, jlpt, kanjiSteps);
    cachedContexts.set(method, context);
    return context;
}

/**
 * What the listening library needs to sort "words to learn": the per-word facts
 * from the frequency and JLPT indexes and the learner's kanji method, and the
 * learner's own order (settings, known kanji, the kanji their words already
 * cover). `context` is null until the indexes load; sortWords then falls back
 * to most-used-here.
 */
export function useWordOrdering(): { context: WordOrderContext | null; learner: LearnerOrder | null } {
    const { state } = useQuiz();
    const method = state.progress?.kanjiKnowledge.method ?? CONSTANTS.setup.defaultKanjiLearningMethod;
    const contextLoad = useAsyncData(method, () => loadContext(method));
    const context = contextLoad.data ?? cachedContexts.get(method) ?? null;

    const progress = state.progress;
    const settings = state.settings;
    const learner = useMemo<LearnerOrder | null>(() => {
        if (!progress || !settings || !context) return null;
        const order = {
            order: settings.preferredLearningOrder,
            knownKanji: progress.kanjiKnowledge.kanjiSet,
            kanjiStep: progress.kanjiKnowledge.step,
            ignoreKnownKanji: settings.ignoreKnownKanjiRequirement === true,
        };
        return {
            ...order,
            coverageScores: order.order === 'kanji_coverage'
                ? kanjiCoverageScoresFor(
                    new Set(progress.learningQueue.map(item => item.vocabId)),
                    context,
                    order,
                    settings.kanjiCoverageTarget || 1
                )
                : new Map(),
        };
    }, [progress, settings, context]);

    return { context, learner };
}
