import { motion } from "framer-motion";
import { TagsLookup, headwordOf, type Sentence, type Tags, type Vocabulary } from "@gokan/dataset-schema";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { MasteryRing } from "../../components/MasteryRing";
import { JlptChip } from "../../components/JlptChip";
import { TagChip } from "../../components/TagChip";
import { KanjiSpellingNote } from "../../components/KanjiSpellingNote";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { Headword } from "../../components/quiz/Headword";
import { ExpandableSenses } from "../../components/quiz/ExpandableSenses";
import { QuizMasteryCorner } from "../../components/quiz/QuizMasteryCorner";
import { emphasizeGloss } from "../../utils/productionCloze.utils";
import { getCoarsePosLabels, getUniquePosTags, getUniqueRelatedCompounds } from "./quizFormatting";

// The vocab activity's prompts: what each of its exercises shows above the answer.
// The answering itself (input, hints, feedback) is the shared card's.

interface VocabPromptProps {
    vocab: Vocabulary;
    /** True once the card is answered: the answer and the word's page may show. */
    answered: boolean;
    memoryStrength: number;
    /** Opens the word's page; the session pauses there instead of ending. */
    onOpenWord?: () => void;
}

/** The reading quiz: the written form, with what tells homographs apart. */
export function ReadingPrompt({ vocab, answered, memoryStrength, onOpenWord }: VocabPromptProps) {
    const { isMobile } = useResponsive();
    // The word's page opens from the headword only once the card is answered.
    const openWord = answered ? onOpenWord : undefined;
    const posTags = getUniquePosTags(vocab.senses, true);
    const compounds = getUniqueRelatedCompounds(vocab.senses);

    return (
        <>
            {isMobile ? (
                <div className="mb-4">
                    <div className="mb-2">
                        <Headword vocab={vocab} size="md" onClick={openWord} />
                    </div>
                    {(vocab.senses.length > 0 || vocab.jlptLevel) && (
                        <div className="flex flex-wrap gap-1 items-center">
                            {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
                            {posTags.slice(0, 3).map(rawTag => (
                                <TagChip key={rawTag} size="sm">{TagsLookup[rawTag as Tags]}</TagChip>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex justify-end mb-4">
                        <MasteryRing memoryStrength={memoryStrength} size={50} />
                    </div>

                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Headword vocab={vocab} size="lg" onClick={openWord} />
                        </div>

                        {/* Disambiguation helpers */}
                        <div className="flex flex-col items-center py-1 gap-3">
                            {(vocab.senses.length > 0 || vocab.jlptLevel) && (
                                <div className="flex flex-wrap justify-center items-center gap-2">
                                    {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
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
            {answered && <ExpandableSenses senses={vocab.senses} maxDefs={isMobile ? 3 : 5} />}
        </>
    );
}

interface MeaningPromptProps extends VocabPromptProps {
    /** The context sentence, in context mode. */
    sentence: Sentence | null;
    /** Context mode was asked for: without a sentence, the card says it fell back. */
    contextRequested: boolean;
    onVocabClick?: (vocabId: string) => void;
}

/** The meaning quiz: the word alone, or in its context sentence. */
export function MeaningPrompt({ vocab, answered, memoryStrength, onOpenWord, sentence, contextRequested, onVocabClick }: MeaningPromptProps) {
    const { isMobile } = useResponsive();

    return (
        <>
            <div className="flex flex-col items-center mb-8">
                <div className="flex justify-end w-full mb-4">
                    {!isMobile && (
                        <div className="flex flex-col items-center gap-1 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                            <MasteryRing memoryStrength={memoryStrength} size={50} />
                        </div>
                    )}
                </div>

                <h2 className="text-xl md:text-2xl font-serif text-secondary text-center leading-relaxed max-w-2xl mx-auto">
                    {sentence ? (
                        <>
                            What is the original meaning of <span className="text-primary font-bold mx-1">{headwordOf(vocab)}</span> in this sentence?
                        </>
                    ) : (
                        <>What is the meaning of this word?</>
                    )}
                </h2>
                {/* Context mode is authoritative: a failed sentence load is said, never
                    silently downgraded to the word alone. */}
                {contextRequested && !sentence && (
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
                                targetVocabId={vocab.id}
                                onVocabClick={onVocabClick}
                                showFurigana={answered}
                                allowTargetClickable={answered}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center mb-4">
                        <Headword
                            vocab={vocab}
                            size="md"
                            showReading={answered}
                            onClick={answered ? onOpenWord : undefined}
                        />
                        {/* Shown before answering: a word in kana can share its kana with
                            another word (いる is 居る and 要る), and the kanji spelling tells
                            them apart. It is also how the learner meets that spelling. */}
                        <KanjiSpellingNote vocab={vocab} className="mt-3" />
                    </div>
                )}

                {(vocab.senses.length > 0 || vocab.jlptLevel) && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                        {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
                        {getUniquePosTags(vocab.senses).map(rawTag => (
                            <TagChip key={rawTag}>{TagsLookup[rawTag as Tags]}</TagChip>
                        ))}
                    </div>
                )}
            </div>

            {/* Glosses: feedback only */}
            {answered && (
                <ExpandableSenses
                    senses={vocab.senses}
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
        </>
    );
}

/**
 * The production quiz from a gloss: English in, the word out, the only direction
 * that starts from English. Nothing Japanese shows before feedback: the written
 * form is the answer. When a sentence with the word exists, the production cloze
 * is served instead (ProductionClozeHeader), whose sentence disambiguates
 * near-synonyms a gloss list cannot (必ず vs 常に); the target word stays hidden
 * there too.
 */
export function ProductionPrompt({ vocab, answered, memoryStrength, onOpenWord }: VocabPromptProps) {
    const { isMobile } = useResponsive();

    // Every gloss of the first sense, then the leading gloss of each later sense.
    // A single gloss is often too thin a clue to produce a specific word from, and
    // the full list of every sense is too much of a wall to read mid-session.
    const [firstSense, ...otherSenses] = vocab.senses;
    const promptLines = [
        firstSense?.glosses.join(', '),
        ...otherSenses.slice(0, 3).map(s => s.glosses[0]),
    ].filter((line): line is string => !!line);

    return (
        <>
            <div className="flex flex-col items-center mb-6">
                <div className="flex justify-end w-full mb-4">
                    {!isMobile && (
                        <div className="flex flex-col items-center gap-1 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                            <MasteryRing memoryStrength={memoryStrength} size={50} />
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

                {/* The word type (verb / noun / adjective) narrows down which of
                    several words with the same gloss is wanted, so it shows before
                    feedback - a plain coarse label, not the full grammatical class. */}
                {(vocab.senses.length > 0 || vocab.jlptLevel) && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
                        {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
                        {getCoarsePosLabels(vocab.senses).map(label => <TagChip key={label}>{label}</TagChip>)}
                    </div>
                )}
            </div>

            {/* The written form is the answer, so it appears only with feedback. */}
            {answered && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <button
                        type="button"
                        onClick={() => onOpenWord?.()}
                        disabled={!onOpenWord}
                        title={`Open the page for ${headwordOf(vocab)}`}
                        className="relative inline-flex items-start text-5xl leading-none text-primary font-mincho rounded underline decoration-dashed decoration-1 underline-offset-8 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:no-underline"
                    >
                        {vocab.usuallyKana ? (
                            <span>{headwordOf(vocab)}</span>
                        ) : (
                            <ruby className="ruby-text">
                                {headwordOf(vocab)}
                                <rt className="text-sm font-sans text-secondary not-italic">{vocab.reading.primary}</rt>
                            </ruby>
                        )}
                    </button>
                    <KanjiSpellingNote vocab={vocab} className="mt-3" />
                </motion.div>
            )}
        </>
    );
}

/**
 * The production cloze's header: mastery, the word type, and the sentence's
 * English translation with the word the blank asks for emphasized (the matching
 * gloss bolded, or a small gloss label when the translation carries no verbatim
 * gloss), since the bare translation was too ambiguous to tell which word to give.
 */
export function ProductionClozeHeader({ vocab, sentence, memoryStrength }: { vocab: Vocabulary; sentence: Sentence; memoryStrength: number }) {
    const posLabels = getCoarsePosLabels(vocab.senses);
    const cueEmphasis = emphasizeGloss(sentence.en[0]?.text ?? '', vocab.senses.flatMap(s => s.glosses));

    return (
        <>
            <QuizMasteryCorner memoryStrength={memoryStrength} />

            {/* JLPT level + the word type being produced: a coarse cue that helps
                pick the right word among near-synonyms, without leaking it. */}
            {(vocab.jlptLevel || posLabels.length > 0) && (
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                    {vocab.jlptLevel && <JlptChip level={vocab.jlptLevel} />}
                    {posLabels.map(label => <TagChip key={label}>{label}</TagChip>)}
                </div>
            )}

            <p className="text-center text-sm text-secondary font-gothic mb-1">
                Fill in the blank
                {!cueEmphasis.inline && cueEmphasis.labelGlosses.length > 0 && (
                    <span className="text-accent font-semibold"> · {cueEmphasis.labelGlosses.join(' / ')}</span>
                )}
            </p>
            <p className="text-center text-lg text-primary font-serif mb-8">
                {cueEmphasis.inline ? (
                    <>
                        {cueEmphasis.inline.before}
                        <span className="text-accent font-bold">{cueEmphasis.inline.match}</span>
                        {cueEmphasis.inline.after}
                    </>
                ) : (
                    sentence.en[0]?.text
                )}
            </p>
        </>
    );
}
