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
    /** On a centred card (the intro). The sentence row is as wide as the sentence and centred, so its
     *  button sits right after it at every width. On a phone the translation is centred on the sentence's
     *  column (the button set aside), so the two share one axis (about 24px left of the headword's): a
     *  spacer balancing the button would cost the sentence 48px of a 320px line, wrapping a one-line
     *  sentence and pushing Learn off the first screen. From `md` up the line can spare it: a spacer
     *  balances the button and the translation is centred on the card, so both sit on the headword's axis. */
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
    const audio = playable ? sentence.audio : undefined;
    // Centred on a phone: as wide as the sentence's column, the button and its gap (w-11, gap-1) set aside.
    const column = centred && audio ? 'pr-12 md:pr-0' : '';
    return (
        <div data-example-sentence>
            <SentenceWithPlay audio={audio} centred={centred}>
                <div className="text-xl text-primary">
                    <InteractiveSentence
                        sentence={sentence}
                        targetVocabId={vocabId}
                        onVocabClick={onVocabClick ?? (vid => void navigate(vocabPath(vid)))}
                        showFurigana={true}
                        keyboardLinks={keyboardLinks}
                    />
                </div>
            </SentenceWithPlay>
            {english && <p data-sentence-english className={`type-support mt-1 ${column}`}><Marked text={english} ranges={englishRanges(query, english)} /></p>}
        </div>
    );
}
