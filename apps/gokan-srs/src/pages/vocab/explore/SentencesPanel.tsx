import { useMemo, useState } from "react";
import type { Sentence } from "@gokan/dataset-schema";
import { TextButton } from "../../../components/ui/TextButton";
import { matchesExploreQuery, resultCountLine } from "../../../utils/exploreSearch.utils";
import { WordSentence } from "../../../components/WordSentence";
import { PanelSearch } from "../../../components/search/PanelSearch";
import { ShowMore } from "../../../components/search/ShowMore";
import { usePagedPanel } from "../../../components/search/usePagedPanel";

const PAGE = 5;

/** Every example sentence of the word, 5 at a time, searchable, in the dataset's order or shortest first. */
export function SentencesPanel({ vocabId, sentences }: { vocabId: string; sentences: readonly Sentence[] }) {
    const panel = usePagedPanel(PAGE);
    const { query } = panel;
    const [shortestFirst, setShortestFirst] = useState(false);

    const matched = useMemo(() => {
        const kept = query
            ? sentences.filter(s => matchesExploreQuery(query, { english: s.en.map(e => e.text), japanese: [s.original] }))
            : [...sentences];
        return shortestFirst ? kept.sort((a, b) => a.original.length - b.original.length) : kept;
    }, [sentences, query, shortestFirst]);

    return (
        <div>
            {panel.searchable(sentences.length) && <PanelSearch
                text={panel.text}
                onChange={panel.setText}
                label="Search the sentences"
                placeholder="Search in English or Japanese"
                countLine={resultCountLine(matched.length, sentences.length, 'sentence', query)}
                aside={(
                    <TextButton onClick={() => setShortestFirst(!shortestFirst)} ariaPressed={shortestFirst} className={shortestFirst ? 'font-semibold' : ''}>
                        Shortest first
                    </TextButton>
                )}
            />}
            <div className="space-y-4">
                {matched.slice(0, panel.shown()).map(sentence => <WordSentence key={sentence.id} vocabId={vocabId} sentence={sentence} query={query} />)}
            </div>
            <ShowMore panel={panel} total={matched.length} className="mt-4" />
        </div>
    );
}
