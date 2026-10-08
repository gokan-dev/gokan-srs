import { useNavigate } from "react-router-dom";
import type { GrammarExample } from "@gokan/dataset-schema";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { grammarExampleToSentence, patternHighlightRanges } from "../../utils/grammarSentence.utils";

/**
 * Example sentences on a grammar point's page: each word links to its vocab page, the
 * point's pattern is highlighted, with romaji and translation beneath. Used for the
 * curated examples and the corpus-mined ones alike.
 */
export function GrammarExampleList({ examples }: { examples: GrammarExample[] }) {
    const navigate = useNavigate();
    return (
        <div>
            {examples.map((example, i) => (
                <div key={i} className={`pb-4 ${i < examples.length - 1 ? 'border-b border-divider mb-4' : ''}`}>
                    <div className="text-xl leading-relaxed text-primary mb-1">
                        <InteractiveSentence
                            sentence={grammarExampleToSentence(example, `grammar-example-${i}`)}
                            onVocabClick={(vid) => void navigate(`/vocab/${vid}`)}
                            showFurigana={true}
                            highlightRanges={patternHighlightRanges(example)}
                        />
                    </div>
                    <div className="text-sm text-tertiary font-gothic mb-1">{example.romaji}</div>
                    <div className="text-sm text-secondary font-serif">{example.en}</div>
                </div>
            ))}
        </div>
    );
}
