import { headwordOf } from "@gokan/dataset-schema";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { CardSection } from "./ui/CardSection";
import { JlptChip } from "./JlptChip";
import { IntroCardShell } from "./IntroCardShell";
import { WordSentence } from "./WordSentence";
import { WordReading } from "./WordReading";
import { HeadwordKanji } from "./lookup/HeadwordKanji";

interface IntroVocabCardProps {
    vocab: Vocabulary;
    /** The word in use (cardSentences.ts); null shows no sentence section. */
    sentence: Sentence | null;
    /** Opens a word of the sentence; in a session it pauses, never ends. A lookup card's own
     *  links ("Open word page", "Open kanji page") go to consult routes, which pause it too. */
    onVocabClick: (vocabId: string) => void;
    onLearn: () => void;
    onSkip: () => void;
}

/**
 * A new word before its first exercise: heard (its reading and its sentence play, since nothing
 * has been asked yet), its kanji looked up as on its page, and its page one lookup card away.
 */
export default function VocabIntroCard({ vocab, sentence, onVocabClick, onLearn, onSkip }: IntroVocabCardProps) {
    const headword = headwordOf(vocab);
    return (
        <IntroCardShell onLearn={onLearn} onSkip={onSkip} learnLabel="Learn this word">
            {/* Kanji */}
            <CardSection>
                <div className="text-center">
                    {/* Its kanji open their cards, as on the word page (a word shown in kana has none). */}
                    <div lang="ja" data-intro-headword className="text-primary font-mincho leading-none text-kanji flex items-center justify-center">
                        <HeadwordKanji headword={headword} kanji={vocab.writtenForm.containedKanji} />
                    </div>

                    {/* Its reading and play button, as on the word page, centred under the headword. */}
                    <WordReading vocab={vocab} variant="intro" className="mt-4" />
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

            {/* The word in use: the easiest sentence for this learner, the one its production cloze picks.
                It plays: no exercise on this word has been asked yet, so hearing it gives nothing away. */}
            {sentence && (
                <CardSection className="text-center">
                    <WordSentence vocabId={vocab.id} sentence={sentence} onVocabClick={onVocabClick} keyboardLinks={false} centred />
                </CardSection>
            )}
        </IntroCardShell>
    );
}
