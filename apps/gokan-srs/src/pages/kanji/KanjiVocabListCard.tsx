import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import type { Vocabulary } from "../../models/vocabulary.model";
import { VocabularyService } from "../../services/vocabulary.service";
import { useNavigate } from "react-router-dom";
import { useResponsive } from "../../context/Responsive/useResponsive";

interface Props {
    vocabIds: string[];
}

const INITIAL_COUNT = 5;

export function KanjiVocabListCard({ vocabIds }: Props) {
    const { isMobile } = useResponsive();
    const navigate = useNavigate();

    const [vocabs, setVocabs] = useState<Vocabulary[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const isExpandable = vocabIds.length > INITIAL_COUNT;
    const displayedIds = isExpanded ? vocabIds : vocabIds.slice(0, INITIAL_COUNT);

    useEffect(() => {
        setIsExpanded(false);
    }, [vocabIds]);

    useEffect(() => {
        const load = async () => {
            if (displayedIds.length === 0) {
                setVocabs([]);
                return;
            }
            const loaded = await Promise.all(displayedIds.map(id => VocabularyService.loadVocab(id).catch(() => null)));
            setVocabs(loaded.filter(v => v !== null) as Vocabulary[]);
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded, vocabIds]);

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
