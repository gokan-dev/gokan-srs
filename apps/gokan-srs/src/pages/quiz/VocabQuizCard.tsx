import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { CONSTANTS } from "../../commons/constants";
import { MasteryRing } from "../../components/MasteryRing";
import { TagsLookup, type Tags } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { TagChip } from "../../components/TagChip";
import { Headword } from "../../components/quiz/Headword";
import { ExpandableSenses } from "../../components/quiz/ExpandableSenses";
import { VocabBaseQuizCard } from "./VocabBaseQuizCard";
import { formatReadingList, getUniquePosTags, getUniqueRelatedCompounds } from "./quizFormatting";

interface VocabQuizCardProps {
    onKanjiClick?: () => void;
}

/** The vocab reading quiz - hiragana recall for the currently-loaded vocab. */
export function VocabQuizCard({ onKanjiClick }: VocabQuizCardProps) {
    const { state, currentProgress } = useQuiz();
    const { isMobile } = useResponsive();

    const { currentVocab, feedback } = state;

    if (!currentVocab) return null;

    // The word's page opens from the headword only once the card is answered.
    const openWord = feedback?.show && onKanjiClick ? onKanjiClick : undefined;
    const posTags = getUniquePosTags(currentVocab.senses, true);
    const compounds = getUniqueRelatedCompounds(currentVocab.senses);

    return (
        <VocabBaseQuizCard
            inputLabel="Reading (hiragana)"
            inputPlaceholder={CONSTANTS.quiz.hiraganaAnswerPlaceholder}
            renderCorrectAnswer={() => (
                <div className="text-center text-2xl mb-1 text-primary font-gothic">
                    {feedback?.type === 'minor_error'
                        ? feedback.matchedAnswer
                        : formatReadingList(currentVocab.reading)}
                </div>
            )}
        >
            {isMobile ? (
                <div className="mb-4">
                    <div className="mb-2">
                        <Headword vocab={currentVocab} size="md" onClick={openWord} />
                    </div>
                    {(currentVocab.senses.length > 0 || currentVocab.jlptLevel) && (
                        <div className="flex flex-wrap gap-1 items-center">
                            {currentVocab.jlptLevel && <JlptChip level={currentVocab.jlptLevel} />}
                            {posTags.slice(0, 3).map(rawTag => (
                                <TagChip key={rawTag} size="sm">{TagsLookup[rawTag as Tags]}</TagChip>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex justify-end mb-4">
                        <MasteryRing memoryStrength={currentProgress?.reading.memoryStrength ?? 0} size={50} />
                    </div>

                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Headword vocab={currentVocab} size="lg" onClick={openWord} />
                        </div>

                        {/* Disambiguation helpers */}
                        <div className="flex flex-col items-center py-1 gap-3">
                            {(currentVocab.senses.length > 0 || currentVocab.jlptLevel) && (
                                <div className="flex flex-wrap justify-center items-center gap-2">
                                    {currentVocab.jlptLevel && <JlptChip level={currentVocab.jlptLevel} />}
                                    {posTags.map(rawTag => <TagChip key={rawTag}>{TagsLookup[rawTag as Tags]}</TagChip>)}
                                </div>
                            )}

                            {compounds.length > 0 && (
                                <div className="text-sm text-meaning-muted font-serif">
                                    {compounds.slice(0, 4).join(' ・ ')}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Glosses: feedback only, all senses */}
            {feedback?.show && <ExpandableSenses senses={currentVocab.senses} maxDefs={isMobile ? 3 : 5} />}
        </VocabBaseQuizCard>
    );
}
