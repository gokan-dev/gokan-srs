import { useNavigate } from "react-router-dom";
import type { Sentence } from "@gokan/dataset-schema";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { SentenceWithPlay } from "../../components/PlayButton";
import { Marked } from "../../components/ui/Marked";
import { englishRanges, type ExploreQuery } from "../../utils/exploreSearch.utils";
import { vocabPath } from "../../utils/navigation.utils";

/**
 * One of a word's example sentences: the Japanese with furigana, the word highlighted and every
 * other word a link, its play button beside its first line, and its English under it, a search's matches marked.
 */
export function WordSentence({ vocabId, sentence, query = null }: { vocabId: string; sentence: Sentence; query?: ExploreQuery | null }) {
    const navigate = useNavigate();
    const english = sentence.en[0]?.text;
    return (
        <div data-example-sentence>
            <SentenceWithPlay audio={sentence.audio}>
                <div className="text-xl text-primary">
                    <InteractiveSentence
                        sentence={sentence}
                        targetVocabId={vocabId}
                        onVocabClick={(vid) => void navigate(vocabPath(vid))}
                        showFurigana={true}
                        keyboardLinks
                    />
                </div>
            </SentenceWithPlay>
            {english && <p className="type-support mt-1"><Marked text={english} ranges={englishRanges(query, english)} /></p>}
        </div>
    );
}
