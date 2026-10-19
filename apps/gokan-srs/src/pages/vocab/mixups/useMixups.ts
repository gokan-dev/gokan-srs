import { useMemo } from "react";
import type { Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../../context/useQuiz";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useNow } from "../../../hooks/useNow";
import { VocabularyService } from "../../../services/vocabulary.service";
import { pairRelation } from "../../../services/exercise/wordRelation";
import { mixupGroups, mixupPairs, mixupWordIds, resolveAnswers } from "../../../utils/mixupGroups.utils";
import type { MixupGroup, MixupPair } from "../../../utils/mixupGroups.utils";

export interface Mixups {
    pairs: MixupPair[];
    groups: MixupGroup[];
    /** Every word the records name, once loaded. */
    vocabById: ReadonlyMap<string, Vocabulary>;
    /** True until the words (and the search index, for raw answers) have loaded. */
    loading: boolean;
    /**
     * What failed to load, shown rather than skipped (data integrity fails loudly): the
     * words whose file did not load, and whether the raw answers could not be looked up.
     */
    failed: { words: number; index: boolean };
}

/**
 * The learner's mix-ups as pairs and groups, for the Mix-ups page and a word's
 * "Often mixed up with" (`vocabId`: that word's own records only). Raw answers are resolved through the search index; every
 * pair's tier is read through relationOf (pairRelation) on the loaded words, so the
 * page shows what grading uses.
 */
export function useMixups(vocabId?: string): Mixups {
    const { state } = useQuiz();
    const now = useNow(60_000);
    const stored = state.progress?.mixups;
    // One word's page needs only its own records, and only their words loaded. Raw answers
    // on another word's card that resolve to this one are left to the Mix-ups page: looking
    // them up would load the search index (3 MB) on every word page.
    const records = useMemo(
        () => (vocabId === undefined ? stored : stored?.filter(r => r.asked === vocabId || r.typed === vocabId)),
        [stored, vocabId],
    );
    const queue = state.progress?.learningQueue;
    const learning = useMemo(() => new Set((queue ?? []).map(v => v.vocabId)), [queue]);

    const hasRaw = (records ?? []).some(r => r.typed === undefined);
    const index = useAsyncData(hasRaw ? 'search-index' : null, () => VocabularyService.loadSearchIndex());
    const resolved = useMemo(
        () => (index.data ? resolveAnswers(records ?? [], index.data, learning) : (records ?? []).filter(r => r.typed !== undefined)),
        [records, index.data, learning],
    );

    const ids = useMemo(() => mixupWordIds(resolved), [resolved]);
    const vocabs = useAsyncData(ids.length > 0 ? ids.join(',') : null, () => VocabularyService.loadVocabs(ids), { keepPrevious: true });
    const vocabById = useMemo(() => new Map((vocabs.data ?? []).map(v => [v.id, v])), [vocabs.data]);

    const pairs = useMemo(
        () => mixupPairs(resolved, (asked, typed) => pairRelation(vocabById.get(asked), typed), now),
        [resolved, vocabById, now],
    );
    const groups = useMemo(() => mixupGroups(pairs), [pairs]);

    const vocabsReady = vocabs.status === 'ready';
    return {
        pairs,
        groups,
        vocabById,
        loading: (hasRaw && index.status === 'loading') || vocabs.status === 'loading',
        failed: {
            words: vocabsReady ? ids.filter(id => !vocabById.has(id)).length : vocabs.status === 'error' ? ids.length : 0,
            index: hasRaw && (index.status === 'error' || (index.status === 'ready' && index.data === null)),
        },
    };
}
