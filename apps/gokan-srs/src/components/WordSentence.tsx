import type { Sentence } from "@gokan/dataset-schema";
import { InteractiveSentence } from "./InteractiveSentence";
import { SentenceWithPlay } from "./PlayButton";
import { Marked } from "./ui/Marked";
import { englishRanges, type ExploreQuery } from "../utils/exploreSearch.utils";

interface WordSentenceProps {
    vocabId: string;
    sentence: Sentence;
    /** Opens a word: the word page navigates, a session pauses (its own handler). */
    onVocabClick: (vocabId: string) => void;
    query?: ExploreQuery | null;
    /** Its play button beside it; off on a study card, where listening is an exercise. */
    playable?: boolean;
}

/**
 * One of a word's example sentences: the Japanese with furigana, the word highlighted and every
 * other word a link, its play button beside its first line, and its English under it, a search's matches marked.
 * The word page's examples and the intro card's one example.
 */
export function WordSentence({ vocabId, sentence, onVocabClick, query = null, playable = true }: WordSentenceProps) {
    const english = sentence.en[0]?.text;
    return (
        <div data-example-sentence>
            <SentenceWithPlay audio={playable ? sentence.audio : undefined}>
                <div className="text-xl text-primary">
                    <InteractiveSentence
                        sentence={sentence}
                        targetVocabId={vocabId}
                        onVocabClick={onVocabClick}
                        showFurigana={true}
                        keyboardLinks
                    />
                </div>
            </SentenceWithPlay>
            {english && <p className="type-support mt-1"><Marked text={english} ranges={englishRanges(query, english)} /></p>}
        </div>
    );
}
