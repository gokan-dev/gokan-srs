import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { Card } from '../../components/ui/Card';
import { VocabularyService } from '../../services/vocabulary.service';
import type { Sentence } from '@gokan/dataset-schema';
import { InteractiveSentence } from '../../components/InteractiveSentence';
import { useAsyncData } from '../../hooks/useAsyncData';

interface VocabSentencesCardProps {
    vocabId: string;
}

export function VocabSentencesCard({ vocabId }: VocabSentencesCardProps) {
    const navigate = useNavigate();
    const loaded = useAsyncData(vocabId, () => VocabularyService.loadSentences(vocabId));
    // Expansion belongs to one word: keyed by it, so moving to another word starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const isExpanded = expandedFor === vocabId;
    const setIsExpanded = (expanded: boolean) => setExpandedFor(expanded ? vocabId : null);

    const sentences: Sentence[] = loaded.data ?? [];
    if (sentences.length === 0) return null;

    const INITIAL_COUNT = 5;
    const isExpandable = sentences.length > INITIAL_COUNT;
    const displayedSentences = isExpanded ? sentences : sentences.slice(0, INITIAL_COUNT);

    const SentenceItem = ({ sentence, isLast }: { sentence: Sentence, isLast: boolean }) => (
        <div key={sentence.id} className={`pb-4 ${isLast && !isExpandable ? '' : 'border-b border-divider mb-4'}`}>
            <div className="text-xl leading-relaxed text-primary mb-1">
                <InteractiveSentence
                    sentence={sentence}
                    targetVocabId={vocabId}
                    onVocabClick={(vid) => void navigate(`/vocab/${vid}`)}
                    showFurigana={true}
                />
            </div>
            {sentence.en && sentence.en.length > 0 && (
                <div className="text-sm text-secondary font-serif">
                    {sentence.en[0].text}
                </div>
            )}
        </div>
    );

    return (
        <Card>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4 flex-none">
                Example Sentences <span className="text-sm font-normal text-tertiary ml-2">({sentences.length})</span>
            </h2>
            <div className="w-full">
                {isExpanded ? (
                    <Virtuoso
                        useWindowScroll
                        data={sentences}
                        itemContent={(index, sentence) => (
                            <SentenceItem sentence={sentence} isLast={index === sentences.length - 1} />
                        )}
                        components={{
                            Footer: () => (
                                <div className="mt-4 text-center">
                                    <button
                                        onClick={() => setIsExpanded(false)}
                                        className="text-sm font-gothic text-accent hover:text-accent/80 transition-colors py-2 px-4 rounded-md border border-accent/20 hover:bg-accent/5 w-full md:w-auto"
                                    >
                                        Show less
                                    </button>
                                </div>
                            )
                        }}
                    />
                ) : (
                    <div>
                        {displayedSentences.map((sentence, index) => (
                            <SentenceItem key={sentence.id} sentence={sentence} isLast={index === displayedSentences.length - 1} />
                        ))}
                    </div>
                )}

                {!isExpanded && isExpandable && (
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-sm font-gothic text-accent hover:text-accent/80 transition-colors py-2 px-4 rounded-md border border-accent/20 hover:bg-accent/5 w-full md:w-auto"
                        >
                            Show all {sentences.length} sentences
                        </button>
                    </div>
                )}
            </div>
        </Card>
    );
}
