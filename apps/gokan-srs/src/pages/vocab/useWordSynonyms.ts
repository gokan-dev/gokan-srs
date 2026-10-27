import { useMemo } from "react";
import type { Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import { listedSynonymsOf } from "../../services/exercise/wordRelation";
import { mixupCounts } from "../../utils/mixups.utils";
import { synonymSections, type SynonymSection } from "../../utils/synonymSections.utils";

/**
 * A word's synonyms as its page lists them (utils/synonymSections.utils.ts), ordered for this
 * learner, and how often each was mixed up with it: computed once for Closest synonyms, the
 * Explore counts and the Synonyms panel.
 */
export function useWordSynonyms(vocab: Vocabulary): { sections: SynonymSection[]; mixedUp: Map<string, number> } {
    const { state } = useQuiz();
    const queue = state.progress?.learningQueue;
    const records = state.progress?.mixups;
    const mixedUp = useMemo(() => mixupCounts(records, vocab.id), [records, vocab.id]);
    const sections = useMemo(() => {
        const studied = new Set((queue ?? []).map(v => v.vocabId));
        return synonymSections(vocab.senses, listedSynonymsOf(vocab), { studied, mixedUp });
    }, [vocab, queue, mixedUp]);
    return { sections, mixedUp };
}
