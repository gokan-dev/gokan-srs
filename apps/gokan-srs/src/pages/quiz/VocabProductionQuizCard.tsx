import { motion } from "framer-motion";
import { useQuiz } from "../../context/useQuiz";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { CONSTANTS } from "../../commons/constants";
import { MasteryRing } from "../../components/MasteryRing";
import { TagsLookup } from "../../models/data.model";
import type { Tags } from "../../models/data.model";
import { JlptChip } from "../../components/JlptChip";
import { VocabBaseQuizCard } from "./VocabBaseQuizCard";
import { formatReadingList, getUniquePosTags } from "./quizFormatting";

interface VocabProductionQuizCardProps {
    onKanjiClick?: () => void;
}

/**
 * The vocab production quiz's GLOSS-PROMPT card: English meaning prompt,
 * Japanese reading answer. The mirror image of VocabMeaningQuizCard, and the
 * only direction in the app that starts from English. Nothing Japanese may
 * appear before feedback on THIS card, which is why it cannot simply reuse
 * VocabQuizCard with a different label: the written form is the answer, so it
 * is revealed only once feedback is showing.
 *
 * VocabQuizScreen renders this whenever state.currentProductionCloze is null -
 * either no sentence with a usable match exists for this word, or the
 * current card isn't production at all. When a match does exist,
 * VocabProductionClozeQuizCard (issue #72) is served instead: it deliberately
 * RELAXES this card's "nothing Japanese before feedback" rule, showing the
 * sentence around the blank as the cue that makes the item well-posed (a bare
 * gloss list cannot disambiguate near-synonyms like 必ず vs 常に - a sentence
 * can). The invariant that actually matters, that the TARGET WORD stays
 * hidden until feedback, is preserved on both cards; only the surrounding
 * context differs.
 *
 * Graded against the reading + written-form accept-list (see
 * SRSService.evaluateProductionAnswer, issue #71 Part A) via
 * useQuizOrchestration's submitAnswer - the same grading path the cloze card
 * uses, since both set quizType 'production'.
 */
export function VocabProductionQuizCard({ onKanjiClick }: VocabProductionQuizCardProps) {
    const { state, currentProgress } = useQuiz();
    const { isMobile } = useResponsive();

    const { currentVocab, feedback } = state;

    if (!currentVocab) return null;

    // Every gloss of the first sense, then the leading gloss of each later sense.
    // A single gloss is often too thin a clue to produce a specific word from, and
    // the full list of every sense is too much of a wall to read mid-session.
    const [firstSense, ...otherSenses] = currentVocab.senses;
    const promptLines = [
        firstSense?.glosses.join(', '),
        ...otherSenses.slice(0, 3).map(s => s.glosses[0]),
    ].filter((line): line is string => !!line);

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
            <div className="flex flex-col items-center mb-6">
                <div className="flex justify-end w-full mb-4">
                    {!isMobile && (
                        <div className="flex flex-col items-center gap-1 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                            <MasteryRing memoryStrength={currentProgress?.production?.memoryStrength ?? 0} size={50} />
                        </div>
                    )}
                </div>

                <h2 className="text-xl md:text-2xl font-serif text-secondary text-center leading-relaxed max-w-2xl mx-auto">
                    Which word means this?
                </h2>
            </div>

            {/* The English prompt. No Japanese anywhere on this card before feedback. */}
            <div className="text-center mb-6">
                <div className={`font-serif text-primary leading-relaxed ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                    {promptLines[0]}
                </div>

                {promptLines.length > 1 && (
                    <div className="mt-3 space-y-1 text-sm text-meaning-muted font-serif">
                        {promptLines.slice(1).map((line, index) => (
                            <p key={index}>{line}</p>
                        ))}
                    </div>
                )}

                {/* POS tags narrow down which of several words with the same gloss is
                    wanted (e.g. a verb vs. its noun form), so they show before feedback. */}
                {(currentVocab.senses.length > 0 || currentVocab.jlptLevel) && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
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

            {/* The written form is the answer, so it appears only with feedback. */}
            {feedback?.show && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <div
                        className={`relative inline-flex items-start text-5xl leading-none text-primary font-mincho ${onKanjiClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        onClick={() => onKanjiClick?.()}
                    >
                        <ruby className="ruby-text">
                            {currentVocab.writtenForm.kanji}
                            <rt className="text-sm font-sans text-secondary not-italic">{currentVocab.reading.primary}</rt>
                        </ruby>
                    </div>
                </motion.div>
            )}
        </VocabBaseQuizCard>
    );
}
