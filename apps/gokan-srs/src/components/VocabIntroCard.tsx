import { headwordOf } from "@gokan/dataset-schema";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { CardSection } from "./ui/CardSection";
import { KanjiSpellingNote } from "./KanjiSpellingNote";
import { formatReadingList } from "../pages/quiz/quizFormatting";
import { JlptChip } from "./JlptChip";
import { IntroCardShell } from "./IntroCardShell";
import { WordSentence } from "./WordSentence";

interface IntroVocabCardProps {
    vocab: Vocabulary;
    /** The word in use (cardSentences.ts); null shows no sentence section. */
    sentence: Sentence | null;
    /** Opens a word of the sentence; in a session it pauses, never ends. */
    onVocabClick: (vocabId: string) => void;
    onLearn: () => void;
    onSkip: () => void;
}

export default function VocabIntroCard({ vocab, sentence, onVocabClick, onLearn, onSkip }: IntroVocabCardProps) {
    return (
        <IntroCardShell onLearn={onLearn} onSkip={onSkip} learnLabel="Learn this word">
            {/* Kanji */}
            <CardSection>
                <div className="text-center">
                    <div className="text-primary font-mincho leading-none text-kanji flex items-center justify-center">
                        {headwordOf(vocab)}
                    </div>

                    {/* A word shown in kana already shows its reading: name its kanji spelling instead. */}
                    {vocab.usuallyKana ? (
                        <KanjiSpellingNote vocab={vocab} className="mt-4" />
                    ) : (
                        <div className="flex flex-row justify-center items-center gap-1 mt-4 text-base font-gothic text-secondary/90 opacity-90">
                            {formatReadingList(vocab.reading)}
                        </div>
                    )}
                    {vocab.jlptLevel && (
                        <div className="flex justify-center mt-3">
                            <JlptChip level={vocab.jlptLevel} />
                        </div>
                    )}
                </div>
            </CardSection>

            {/* Meanings */}
            <CardSection>
                <div className="text-center font-serif text-base text-primary leading-relaxed">
                    {vocab.senses.map((sense, i) => (
                        <span key={i}>
                            {sense.appliesToReadings && sense.appliesToReadings.length > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary mr-1 font-gothic">[{sense.appliesToReadings.join(', ')}]</span>
                            )}
                            {sense.glosses.join(', ')}
                            {i !== vocab.senses.length - 1 ? ', ' : ''}
                        </span>
                    ))}
                </div>
            </CardSection>

            {/* The word in use: the easiest sentence for this learner, the one its production cloze picks. */}
            {sentence && (
                <CardSection className="text-center">
                    <WordSentence vocabId={vocab.id} sentence={sentence} onVocabClick={onVocabClick} playable={false} />
                </CardSection>
            )}
        </IntroCardShell>
    );
}
