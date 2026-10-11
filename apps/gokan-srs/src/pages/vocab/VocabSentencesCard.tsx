import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { VocabularyService } from '../../services/vocabulary.service';
import type { Sentence } from '@gokan/dataset-schema';
import { InteractiveSentence } from '../../components/InteractiveSentence';
import { DetailSection } from '../../components/detail/DetailSection';
import { useAsyncData } from '../../hooks/useAsyncData';

const INITIAL_COUNT = 3;

const SHOW_MORE = 'mt-3 font-sans text-sm text-accent hover:underline cursor-pointer';

/** A word's example sentences: three, then all of them (virtualized, some words have hundreds). */
export function VocabSentencesCard({ vocabId }: { vocabId: string }) {
    const navigate = useNavigate();
    const loaded = useAsyncData(vocabId, () => VocabularyService.loadSentences(vocabId));
    // Expansion belongs to one word: keyed by it, so moving to another word starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const isExpanded = expandedFor === vocabId;

    const sentences: Sentence[] = loaded.data ?? [];
    if (sentences.length === 0) return null;

    // No margins: Virtuoso measures each item's box height, and a margin sits
    // outside it, so the list would under-measure. Padding stays inside the box.
    const renderSentence = (sentence: Sentence) => (
        <div key={sentence.id} className="py-3 border-b border-divider last:border-b-0">
            <div className="text-xl text-primary">
                <InteractiveSentence
                    sentence={sentence}
                    targetVocabId={vocabId}
                    onVocabClick={(vid) => void navigate(`/vocab/${vid}`)}
                    showFurigana={true}
                    keyboardLinks
                />
            </div>
            {sentence.en && sentence.en.length > 0 && (
                <p className="type-support mt-1">{sentence.en[0].text}</p>
            )}
        </div>
    );

    return (
        <DetailSection title="Example sentences" count={sentences.length}>
            {isExpanded ? (
                <Virtuoso
                    useWindowScroll
                    data={sentences}
                    itemContent={(_index, sentence) => renderSentence(sentence)}
                    components={{
                        Footer: () => (
                            <div className="pt-1">
                                <button type="button" onClick={() => setExpandedFor(null)} className={SHOW_MORE}>
                                    Show fewer
                                </button>
                            </div>
                        ),
                    }}
                />
            ) : (
                <>
                    <div>{sentences.slice(0, INITIAL_COUNT).map(renderSentence)}</div>
                    {sentences.length > INITIAL_COUNT && (
                        <button type="button" onClick={() => setExpandedFor(vocabId)} className={SHOW_MORE}>
                            Show all {sentences.length.toLocaleString('en-US')} sentences
                        </button>
                    )}
                </>
            )}
        </DetailSection>
    );
}
