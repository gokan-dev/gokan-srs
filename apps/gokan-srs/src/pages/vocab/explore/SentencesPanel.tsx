import { useMemo, useState } from "react";
import type { Sentence } from "@gokan/dataset-schema";
import { TextButton } from "../../../components/ui/TextButton";
import { matchesExploreQuery, resultCountLine } from "../../../utils/exploreSearch.utils";
import { WordSentence } from "../WordSentence";
import { PanelSearch } from "./PanelSearch";
import { usePanelQuery } from "./usePanelQuery";

const PAGE = 5;

/** Every example sentence of the word, 5 at a time, searchable, in the dataset's order or shortest first. */
export function SentencesPanel({ vocabId, sentences }: { vocabId: string; sentences: readonly Sentence[] }) {
    const { text, setText, query } = usePanelQuery();
    const [shortestFirst, setShortestFirst] = useState(false);
    const [shown, setShown] = useState(PAGE);

    const matched = useMemo(() => {
        const kept = query
            ? sentences.filter(s => matchesExploreQuery(query, { english: s.en.map(e => e.text), japanese: [s.original] }))
            : [...sentences];
        return shortestFirst ? kept.sort((a, b) => a.original.length - b.original.length) : kept;
    }, [sentences, query, shortestFirst]);

    return (
        <div>
            <PanelSearch
                text={text}
                onChange={value => { setText(value); setShown(PAGE); }}
                label="Search the sentences"
                placeholder="Search in English or Japanese"
                countLine={resultCountLine(matched.length, sentences.length, 'sentence', query)}
                aside={(
                    <TextButton onClick={() => setShortestFirst(!shortestFirst)} ariaPressed={shortestFirst} className={shortestFirst ? 'font-semibold' : ''}>
                        Shortest first
                    </TextButton>
                )}
            />
            <div className="space-y-4">
                {matched.slice(0, shown).map(sentence => <WordSentence key={sentence.id} vocabId={vocabId} sentence={sentence} query={query} />)}
            </div>
            {matched.length > shown && (
                <TextButton onClick={() => setShown(shown + PAGE)} className="mt-4">
                    Show {Math.min(PAGE, matched.length - shown)} more
                </TextButton>
            )}
        </div>
    );
}
