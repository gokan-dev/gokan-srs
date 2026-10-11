import { useState } from "react";
import { ListRow } from "../../components/ui/ListRow";
import { FilterToggle } from "../../components/ui/FilterToggle";
import { JlptChip } from "../../components/JlptChip";
import { WordStudyStatus } from "../../components/WordStudyStatus";
import { DetailSection } from "../../components/detail/DetailSection";
import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { VocabularyService } from "../../services/vocabulary.service";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useQuiz } from "../../context/useQuiz";
import { STATUS_LABEL, vocabLearningStatus, type LearningStatus } from "../../utils/learningStatus.utils";

interface Props {
    character: string;
    /** The kanji's words, in frequency order. */
    vocabIds: string[];
}

const INITIAL_COUNT = 10;
const FILTERS: (LearningStatus | 'all')[] = ['all', 'new', 'learning', 'mastered'];

/**
 * "Words with 学": the kanji's words with the learner's status, filterable by it.
 * A word not studied yet can be added from its row (WordStudyStatus).
 */
export function KanjiVocabListCard({ character, vocabIds }: Props) {
    const { state } = useQuiz();
    const settings = state.settings ?? undefined;
    const [filter, setFilter] = useState<LearningStatus | 'all'>('all');
    // Expansion belongs to one kanji: keyed by it, so another kanji's list starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const isExpanded = expandedFor === character;

    const progressById = new Map((state.progress?.learningQueue ?? []).map(p => [p.vocabId, p]));
    const filtered = filter === 'all'
        ? vocabIds
        : vocabIds.filter(id => vocabLearningStatus(progressById.get(id), settings) === filter);
    const displayedIds = isExpanded ? filtered : filtered.slice(0, INITIAL_COUNT);

    // Only the displayed ids are fetched, so expanding loads the rest.
    const vocabs: Vocabulary[] = useAsyncData(displayedIds.join(','), () => VocabularyService.loadVocabs(displayedIds), { keepPrevious: true }).data ?? [];

    if (vocabIds.length === 0) return null;

    return (
        <DetailSection title={`Words with ${character}`} count={vocabIds.length}>
            <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Status">
                {FILTERS.map(f => (
                    <FilterToggle key={f} active={filter === f} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : STATUS_LABEL[f]}
                    </FilterToggle>
                ))}
            </div>

            <div className="flex flex-col divide-y divide-divider -mx-3">
                {vocabs.filter(v => displayedIds.includes(v.id)).map(v => (
                    <ListRow
                        key={v.id}
                        to={`/vocab/${v.id}`}
                        trailing={
                            <div className="flex items-center gap-3">
                                {v.jlptLevel && <span className="hidden sm:inline-flex"><JlptChip level={v.jlptLevel} /></span>}
                                <WordStudyStatus vocabId={v.id} />
                            </div>
                        }
                    >
                        <div className="flex items-baseline gap-2 min-w-0">
                            {/* A word learned in kana lists as ここ with 此処 beside it, as in the dictionary. */}
                            <span className="jp-headword shrink-0">{headwordOf(v)}</span>
                            <span className={`${v.usuallyKana ? 'font-mincho' : 'font-gothic'} text-sm text-secondary truncate`}>{secondaryForm(v)}</span>
                        </div>
                        <div className="type-support truncate">{v.senses[0]?.glosses.join(', ')}</div>
                    </ListRow>
                ))}
            </div>

            {filtered.length === 0 && <p className="type-support">No words with this status.</p>}

            {filtered.length > INITIAL_COUNT && (
                <button
                    type="button"
                    onClick={() => setExpandedFor(isExpanded ? null : character)}
                    className="mt-3 font-sans text-sm text-accent hover:underline cursor-pointer"
                >
                    {isExpanded ? 'Show fewer words' : `Show all ${filtered.length} words`}
                </button>
            )}
        </DetailSection>
    );
}
