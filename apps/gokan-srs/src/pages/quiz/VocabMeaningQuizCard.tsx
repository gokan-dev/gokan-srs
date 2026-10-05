import { motion } from "framer-motion";
import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { MasteryRing } from "../../components/MasteryRing";
import { TagsLookup } from "@gokan/dataset-schema";
import { Combine } from "lucide-react";
import type { Tags } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";

import { VocabBaseQuizCard } from "./VocabBaseQuizCard";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { getUniquePosTags, useExpandableDefinitions } from "./quizFormatting";

interface VocabMeaningQuizCardProps {
    onKanjiClick?: () => void;
    onVocabClick?: (vocabId: string) => void;
}

/** The vocab meaning quiz - English recall, base (word-alone) or context (sentence) mode. */
export function VocabMeaningQuizCard({ onKanjiClick, onVocabClick }: VocabMeaningQuizCardProps) {
    const { state, currentProgress } = useQuiz();
    const { isMobile } = useResponsive();

    // Get data from centralized state
    const { currentVocab, currentSentences, feedback, progress } = state;

    // Get persisted sentence from state
    const sentence = currentSentences && state.currentSentenceId
        ? currentSentences.find(s => s.id === state.currentSentenceId) || null
        : null;

    // quizMode is authoritative - read from state rather than inferred from
    // sentence presence, so a failed sentence load is surfaced explicitly
    // instead of silently downgrading a context quiz to base.
    const isContextMode = state.currentQuizItem?.quizMode === 'context';
    const contextSentenceMissing = isContextMode && !sentence;

    const maxDefs = 5;
    const { displayedSenses, hasMoreDefs, isExpanded, toggleExpanded } = useExpandableDefinitions(currentVocab?.senses ?? [], maxDefs);

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
            {/* Header: Meaning Quiz Label + Mastery */}
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
                        <>
                            What is the meaning of this word?
                        </>
                    )}
                </h2>
                {contextSentenceMissing && (
                    <p className="text-xs text-secondary/70 mt-2 font-gothic italic">
                        Context sentence unavailable, showing the standard quiz instead.
                    </p>
                )}
            </div>

            {/* Content: Sentence OR Kanji */}
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
                    // Fallback to minimal Kanji display if no sentence
                    <div className="flex justify-center mb-4">
                        <div
                            className={`relative inline-flex items-start text-5xl leading-none text-primary font-mincho ${onKanjiClick && feedback?.show ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            onClick={() => feedback?.show && onKanjiClick?.()}
                            title={currentVocab.mergedVocabs && currentVocab.mergedVocabs.length > 1 ? "Merged Entry (combines multiple JMDict words)" : undefined}
                        >
                            {feedback?.show ? (
                                <ruby className="ruby-text">
                                    {currentVocab.writtenForm.kanji}
                                    <rt className="text-sm font-sans text-secondary not-italic">{currentVocab.reading.primary}</rt>
                                </ruby>
                            ) : (
                                <span>{currentVocab.writtenForm.kanji}</span>
                            )}
                            {/* Merged Entry Icon */}
                            {currentVocab.mergedVocabs && currentVocab.mergedVocabs.length > 1 && (
                                <span className="absolute -right-6 top-0">
                                    <Combine size={18} className="text-divider opacity-40" />
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* POS Tags + JLPT chip */}
                {(currentVocab.senses.length > 0 || currentVocab.jlptLevel) && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                        {currentVocab.jlptLevel && <JlptChip level={currentVocab.jlptLevel} />}
                        {getUniquePosTags(currentVocab.senses).map(rawTag => (
                            <span
                                key={rawTag}
                                className="px-2 py-0.5 text-xs rounded bg-accent/10 text-accent font-gothic font-medium dark:bg-accent/15"
                            >
                                {TagsLookup[rawTag as Tags]}
                            </span>
                        ))}
                    </div>
                )}

            </div>

            {/* Glosses — feedback only */}
            {feedback?.show && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm space-y-2 text-meaning-muted font-serif"
                >
                    <p className="font-bold text-primary mb-1">Meanings:</p>
                    {displayedSenses.map((sense, index) => (
                        <p key={index}>
                            {sense.appliesToReadings && sense.appliesToReadings.length > 0 && (
                                <span className="text-xs text-tertiary mr-2 font-gothic">[{sense.appliesToReadings.join(', ')}]</span>
                            )}
                            {sense.glosses.join(', ')}
                        </p>
                    ))}
                    
                    {hasMoreDefs && (
                        <button
                            type="button"
                            onClick={toggleExpanded}
                            className="text-xs text-secondary hover:text-primary transition-colors py-1 cursor-pointer font-gothic"
                        >
                            {isExpanded ? "Show less" : `+${currentVocab.senses.length - maxDefs} more definitions`}
                        </button>
                    )}

                    {sentence && sentence.en && (
                        <div className="mt-4 pt-4 border-t border-divider">
                            <p className="font-bold text-primary mb-1">Translation:</p>
                            <p className="italic text-secondary">
                                {sentence.en[0].text /* Just show first translation */}
                            </p>
                        </div>
                    )}
                </motion.div>
            )}
        </VocabBaseQuizCard>
    );
}
