import { useState } from "react";
import { Card } from "../../components/ui/Card";
import type { Vocabulary } from "../../models/vocabulary.model";
import { VocabularyService } from "../../services/vocabulary.service";
import { useNavigate } from "react-router-dom";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { useAsyncData } from "../../hooks/useAsyncData";

interface Props {
    vocabIds: string[];
}

const INITIAL_COUNT = 5;

export function KanjiVocabListCard({ vocabIds }: Props) {
    const { isMobile } = useResponsive();
    const navigate = useNavigate();

    // Expansion belongs to one list: keyed by it, so another kanji's list starts collapsed.
    const listKey = vocabIds.join(',');
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const isExpanded = expandedFor === listKey;
    const setIsExpanded = (expanded: boolean) => setExpandedFor(expanded ? listKey : null);

    const isExpandable = vocabIds.length > INITIAL_COUNT;
    const displayedIds = isExpanded ? vocabIds : vocabIds.slice(0, INITIAL_COUNT);

    // Only the displayed ids are fetched, so expanding loads the rest.
    const vocabs: Vocabulary[] = useAsyncData(displayedIds.join(','), () => VocabularyService.loadVocabs(displayedIds), { keepPrevious: true }).data ?? [];

    if (vocabIds.length === 0) return null;

    return (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">
                Vocabulary using this kanji ({vocabIds.length})
            </h2>
            <div className="space-y-3">
                {vocabs.map(v => (
                    <div
                        key={v.id}
                        onClick={() => void navigate(`/vocab/${v.id}`)}
                        className="border-l-2 border-divider pl-3 cursor-pointer hover:border-accent transition-colors group"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mincho text-xl text-primary group-hover:text-accent transition-colors">
                                {v.writtenForm.kanji}
                            </span>
                            <span className="font-gothic font-bold text-secondary">
                                {v.reading.primary}
                            </span>
                        </div>
                        <div className="text-sm text-meaning-muted font-serif line-clamp-2">
                            {v.senses && v.senses[0] ? v.senses[0].glosses.join(', ') : 'No definition available'}
                        </div>
                    </div>
                ))}
            </div>

            {isExpandable && (
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-sm font-gothic text-accent hover:text-accent/80 transition-colors py-2 px-4 rounded-md border border-accent/20 hover:bg-accent/5 w-full md:w-auto"
                    >
                        {isExpanded ? "Show fewer words" : `Show all ${vocabIds.length} words`}
                    </button>
                </div>
            )}
        </Card>
    );
}
