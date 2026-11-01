import { useNavigate } from "react-router-dom";
import type { Sentence } from "@gokan/dataset-schema";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { PlayButton } from "../../components/PlayButton";
import { Marked } from "../../components/ui/Marked";
import { englishRanges, type ExploreQuery } from "../../utils/exploreSearch.utils";

/**
 * One of a word's example sentences: the Japanese with furigana, the word highlighted and every
 * other word a link, its play button at its end, and its English under it, a search's matches marked.
 */
export function WordSentence({ vocabId, sentence, query = null }: { vocabId: string; sentence: Sentence; query?: ExploreQuery | null }) {
    const navigate = useNavigate();
    const english = sentence.en[0]?.text;
    return (
        <div>
            <div className="text-xl text-primary">
                <InteractiveSentence
                    sentence={sentence}
                    targetVocabId={vocabId}
                    onVocabClick={(vid) => void navigate(`/vocab/${vid}`)}
                    showFurigana={true}
                    keyboardLinks
                />
                <PlayButton audio={sentence.audio} label="Play sentence" className="ml-1" />
            </div>
            {english && <p className="type-support mt-1"><Marked text={english} ranges={englishRanges(query, english)} /></p>}
        </div>
    );
}
