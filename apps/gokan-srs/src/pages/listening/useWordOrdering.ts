import { useEffect, useMemo, useState } from "react";
import { VocabularyService } from "../../services/vocabulary.service";
import { useQuiz } from "../../context/useQuiz";
import { buildWordOrderContext, computeUncoveredKanji } from "../../utils/wordOrder.utils";
import type { LearnerOrder, WordOrderContext } from "../../utils/wordOrder.utils";

/** Built once per page load: the indexes behind it are themselves cached by VocabularyService. */
let cachedContext: WordOrderContext | null = null;

/**
 * What the listening library needs to sort "words to learn": the per-word facts
 * from the frequency, JLPT and KKLC indexes, and the learner's own order
 * (settings, known kanji, the kanji their words already cover). `context` is
 * null until the indexes load; sortWords then falls back to most-used-here.
 */
export function useWordOrdering(): { context: WordOrderContext | null; learner: LearnerOrder | null } {
    const { state } = useQuiz();
    const [context, setContext] = useState<WordOrderContext | null>(cachedContext);

    useEffect(() => {
        if (cachedContext) return;
        let cancelled = false;
        Promise.all([
            VocabularyService.loadFrequencyIndex(),
            VocabularyService.loadJlptIndex(),
            VocabularyService.loadKKLCIndex(),
        ]).then(([frequency, jlpt, kklc]) => {
            if (!frequency || !jlpt || !kklc || cancelled) return;
            cachedContext = buildWordOrderContext(frequency, jlpt, kklc);
            setContext(cachedContext);
        }).catch(() => { /* sorting stays on most-used-here */ });
        return () => { cancelled = true; };
    }, []);

    const progress = state.progress;
    const settings = state.settings;
    const learner = useMemo<LearnerOrder | null>(() => {
        if (!progress || !settings || !context) return null;
        const knownKanji = progress.kanjiKnowledge.kanjiSet;
        return {
            order: settings.preferredLearningOrder,
            knownKanji,
            kklcStep: progress.kanjiKnowledge.step,
            ignoreKnownKanji: settings.ignoreKnownKanjiRequirement === true,
            uncoveredKanji: settings.preferredLearningOrder === 'kanji_coverage'
                ? computeUncoveredKanji(
                    progress.learningQueue.map(item => item.vocabId),
                    knownKanji,
                    context.kanjiOf,
                    settings.kanjiCoverageTarget || 1
                )
                : new Set(),
        };
    }, [progress, settings, context]);

    return { context, learner };
}
