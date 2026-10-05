import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { MasteryRing } from "../../components/MasteryRing";
import { TagsLookup, type Tags } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { TagChip } from "../../components/TagChip";
import { Headword } from "../../components/quiz/Headword";
import { ExpandableSenses } from "../../components/quiz/ExpandableSenses";
import { VocabBaseQuizCard } from "./VocabBaseQuizCard";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { getUniquePosTags } from "./quizFormatting";

interface VocabMeaningQuizCardProps {
    onKanjiClick?: () => void;
    onVocabClick?: (vocabId: string) => void;
}

/** The vocab meaning quiz - English recall, base (word-alone) or context (sentence) mode. */
export function VocabMeaningQuizCard({ onKanjiClick, onVocabClick }: VocabMeaningQuizCardProps) {
    const { state, currentProgress } = useQuiz();
    const { isMobile } = useResponsive();

    const { currentVocab, currentSentences, feedback, progress } = state;

    const sentence = currentSentences && state.currentSentenceId
        ? currentSentences.find(s => s.id === state.currentSentenceId) ?? null
        : null;

    // quizMode is authoritative - read from state rather than inferred from
    // sentence presence, so a failed sentence load is surfaced explicitly
    // instead of silently downgrading a context quiz to base.
    const isContextMode = state.currentQuizItem?.quizMode === 'context';
    const contextSentenceMissing = isContextMode && !sentence;

    if (!currentVocab || !progress) return null;

    return (
        <VocabBaseQuizCard
            inputLabel="Meaning (English)"
            inputPlaceholder="Type the meaning..."
            renderCorrectAnswer={() => (
                <div className="text-center text-xl mb-1 text-primary font-gothic">
                    {feedback?.matchedAnswer || currentVocab.senses.flatMap(s => s.glosses)[0] || "No meaning found"}
                </div>
            )}
        >
            <div className="flex flex-col items-center mb-8">
                <div className="flex justify-end w-full mb-4">
                    {!isMobile && (
                        <div className="flex flex-col items-center gap-1 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                            <MasteryRing memoryStrength={currentProgress?.meaning.memoryStrength ?? 0} size={50} />
                        </div>
                    )}
                </div>

                <h2 className="text-xl md:text-2xl font-serif text-secondary text-center leading-relaxed max-w-2xl mx-auto">
                    {sentence ? (
                        <>
                            What is the original meaning of <span className="text-primary font-bold mx-1">{currentVocab.writtenForm.kanji}</span> in this sentence?
                        </>
                    ) : (
                        <>What is the meaning of this word?</>
                    )}
                </h2>
                {contextSentenceMissing && (
                    <p className="text-xs text-secondary/70 mt-2 font-gothic italic">
                        Context sentence unavailable, showing the standard quiz instead.
                    </p>
                )}
            </div>

            <div className="text-center mb-6">
                {sentence ? (
                    <div className="mb-4">
                        <div className="text-2xl font-serif text-primary mb-2 leading-relaxed">
                            <InteractiveSentence
                                sentence={sentence}
                                targetVocabId={currentVocab.id}
                                onVocabClick={onVocabClick}
                                showFurigana={feedback?.show}
                                allowTargetClickable={feedback?.show}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center mb-4">
                        <Headword
                            vocab={currentVocab}
                            size="md"
                            showReading={!!feedback?.show}
                            onClick={feedback?.show && onKanjiClick ? onKanjiClick : undefined}
                        />
                    </div>
                )}

                {(currentVocab.senses.length > 0 || currentVocab.jlptLevel) && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                        {currentVocab.jlptLevel && <JlptChip level={currentVocab.jlptLevel} />}
                        {getUniquePosTags(currentVocab.senses).map(rawTag => (
                            <TagChip key={rawTag}>{TagsLookup[rawTag as Tags]}</TagChip>
                        ))}
                    </div>
                )}
            </div>

            {/* Glosses: feedback only */}
            {feedback?.show && (
                <ExpandableSenses
                    senses={currentVocab.senses}
                    maxDefs={5}
                    heading={<p className="font-bold text-primary mb-1">Meanings:</p>}
                    footer={sentence?.en[0] && (
                        <div className="mt-4 pt-4 border-t border-divider">
                            <p className="font-bold text-primary mb-1">Translation:</p>
                            <p className="italic text-secondary">{sentence.en[0].text}</p>
                        </div>
                    )}
                />
            )}
        </VocabBaseQuizCard>
    );
}
