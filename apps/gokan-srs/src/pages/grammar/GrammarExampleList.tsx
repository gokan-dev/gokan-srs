import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GrammarExample } from "@gokan/dataset-schema";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { SentenceWithPlay } from "../../components/PlayButton";
import { grammarExampleToSentence, patternHighlightRanges } from "@gokan/dataset-schema";
import { vocabPath } from "../../utils/navigation.utils";

/**
 * Example sentences on a grammar point's page: each word links to its vocab page, the
 * point's pattern is highlighted in accent (the current item), with romaji and
 * translation beneath. Used for the curated examples and the corpus-mined ones alike;
 * `initialCount` shows the first few, then "Show all".
 */
export function GrammarExampleList({ examples, initialCount }: { examples: GrammarExample[]; initialCount?: number }) {
    const navigate = useNavigate();
    const [showAll, setShowAll] = useState(false);
    const shown = showAll || initialCount === undefined ? examples : examples.slice(0, initialCount);

    return (
        // Spaced, not ruled, like a word page's examples: nothing draws a line inside a level.
        <div className="space-y-4">
            {shown.map((example, i) => (
                <div key={i} data-example-sentence>
                    <SentenceWithPlay audio={example.audio}>
                        <div className="text-xl text-primary">
                            <InteractiveSentence
                                sentence={grammarExampleToSentence(example, `grammar-example-${i}`)}
                                onVocabClick={(vid) => void navigate(vocabPath(vid))}
                                showFurigana={true}
                                highlightRanges={patternHighlightRanges(example)}
                                keyboardLinks
                            />
                        </div>
                    </SentenceWithPlay>
                    <p className="type-meta mt-1">{example.romaji}</p>
                    <p className="type-support">{example.en}</p>
                </div>
            ))}
            {!showAll && initialCount !== undefined && examples.length > initialCount && (
                <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="font-sans text-sm text-accent hover:underline cursor-pointer"
                >
                    Show all {examples.length} sentences
                </button>
            )}
        </div>
    );
}
