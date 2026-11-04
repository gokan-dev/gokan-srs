import { useNavigate } from "react-router-dom";
import type { Sentence } from "@gokan/dataset-schema";
import { InteractiveSentence } from "./InteractiveSentence";
import { SentenceWithPlay } from "./PlayButton";
import { Marked } from "./ui/Marked";
import { englishRanges, type ExploreQuery } from "../utils/exploreSearch.utils";
import { vocabPath } from "../utils/navigation.utils";

interface WordSentenceProps {
    vocabId: string;
    sentence: Sentence;
    /** Opens a word: the word page's own by default; a session passes its handler, which pauses. */
    onVocabClick?: (vocabId: string) => void;
    query?: ExploreQuery | null;
    /** Its play button beside it: on the word page and the intro card (before any exercise on the
     *  word); off on a study card, where listening is an exercise. */
    playable?: boolean;
    /** Its words in the Tab order; off on a session card (DESIGN_SYSTEM section 6, Lookup card). */
    keyboardLinks?: boolean;
    /** On a centred card (the intro): its translation goes in the sentence's column, beside the play
     *  button, so the two share one centre axis. A spacer balancing the button instead would cost the
     *  sentence 48px of a 320px line, wrapping a one-line sentence and pushing Learn off the first screen. */
    centred?: boolean;
}

/**
 * One of a word's example sentences: the Japanese with furigana, the word highlighted and every
 * other word a link, its play button beside its first line, and its English under it, a search's matches marked.
 * The word page's examples and the intro card's one example.
 */
export function WordSentence({ vocabId, sentence, onVocabClick, query = null, playable = true, keyboardLinks = true, centred = false }: WordSentenceProps) {
    const navigate = useNavigate();
    const english = sentence.en[0]?.text;
    const translation = english && <p data-sentence-english className="type-support mt-1"><Marked text={english} ranges={englishRanges(query, english)} /></p>;
    return (
        <div data-example-sentence>
            <SentenceWithPlay audio={playable ? sentence.audio : undefined}>
                <div className="text-xl text-primary">
                    <InteractiveSentence
                        sentence={sentence}
                        targetVocabId={vocabId}
                        onVocabClick={onVocabClick ?? (vid => void navigate(vocabPath(vid)))}
                        showFurigana={true}
                        keyboardLinks={keyboardLinks}
                    />
                </div>
                {centred && translation}
            </SentenceWithPlay>
            {!centred && translation}
        </div>
    );
}
