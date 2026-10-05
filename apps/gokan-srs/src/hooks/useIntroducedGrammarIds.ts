import { useMemo } from 'react';
import { useQuiz } from '../context/useQuiz';
import { selectIntroducedGrammarIds } from '../context/quiz/grammarSelectors';

/**
 * The grammar points the learner has already met (introduced, whatever their
 * mastery). Every grammar surface that marks siblings as known, or defers a
 * contrast until its siblings are known, reads this one set.
 */
export function useIntroducedGrammarIds(): Set<string> {
    const { state } = useQuiz();
    const grammarQueue = state.progress?.grammarQueue;
    return useMemo(() => selectIntroducedGrammarIds(grammarQueue ?? []), [grammarQueue]);
}
