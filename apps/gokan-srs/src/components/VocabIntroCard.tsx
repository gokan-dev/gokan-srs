import type { Vocabulary } from "@gokan/dataset-schema";
import { CardSection } from "./ui/CardSection";
import { Combine } from "lucide-react";
import { formatReadingList } from "../pages/quiz/quizFormatting";
import { JlptChip } from "./JlptChip";
import { IntroCardShell } from "./IntroCardShell";


interface IntroVocabCardProps {
    vocab: Vocabulary;
    onLearn: () => void;
    onSkip: () => void;
}

export default function VocabIntroCard({ vocab, onLearn, onSkip }: IntroVocabCardProps) {
    return (
        <IntroCardShell onLearn={onLearn} onSkip={onSkip} learnLabel="Learn this word">
            {/* Kanji */}
            <CardSection>
                <div className="text-center">
                    <div
                        className="text-primary font-mincho leading-none text-kanji flex items-center justify-center gap-3"
                        title={vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? "Merged Entry (combines multiple JMDict words)" : undefined}
                    >
                        {vocab.writtenForm.kanji}
                        {vocab.mergedVocabs && vocab.mergedVocabs.length > 1 && (
                            <Combine size={40} className="text-divider" />
                        )}
                    </div>

                    <div className="flex flex-row justify-center items-center gap-1 mt-4 text-base font-gothic text-secondary/90 opacity-90">
                        {formatReadingList(vocab.reading)}
                    </div>
                    {vocab.jlptLevel && (
                        <div className="flex justify-center mt-3">
                            <JlptChip level={vocab.jlptLevel} />
                        </div>
                    )}
                </div>
            </CardSection>

            {/* Meanings */}
            <CardSection>
                <div className="text-center font-serif text-base text-meaning-muted leading-relaxed">
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
        </IntroCardShell>
    );
}
