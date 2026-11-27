import { useMemo, useState } from "react";
import type { Sentence } from "@gokan/dataset-schema";
import { TextButton } from "../../../components/ui/TextButton";
import { matchesExploreQuery, resultCountLine } from "../../../utils/exploreSearch.utils";
import { sentencesWithPattern } from "../../../utils/wordPatterns.utils";
import { WordSentence } from "../../../components/WordSentence";
import { PanelSearch } from "../../../components/search/PanelSearch";
import { ShowMore } from "../../../components/search/ShowMore";
import { usePagedPanel } from "../../../components/search/usePagedPanel";

const PAGE = 5;

/**
 * Every example sentence of the word, 5 at a time, searchable, in the dataset's order or shortest
 * first. Filtered on one of its common patterns when the Dict tab opened it on one ("Pattern:
 * 不思議に思う", with Clear above the results): the search then looks inside those.
 */
export function SentencesPanel({ vocabId, sentences, patternIndex = null, patternText = null, onClearPattern }: {
    vocabId: string;
    sentences: readonly Sentence[];
    /** The common pattern the panel is filtered on, from the Dict tab: its index and its text,
     * plain values so the filtered list's memo holds across renders. */
    patternIndex?: number | null;
    patternText?: string | null;
    onClearPattern?: () => void;
}) {
    const panel = usePagedPanel(PAGE);
    const { query } = panel;
    const [shortestFirst, setShortestFirst] = useState(false);

    const filtered = patternIndex !== null && patternText !== null;
    const base = useMemo(
        () => (patternIndex !== null && patternText !== null ? sentencesWithPattern(vocabId, sentences, patternIndex) : sentences),
        [vocabId, sentences, patternIndex, patternText],
    );
    const matched = useMemo(() => {
        const kept = query
            ? base.filter(s => matchesExploreQuery(query, { english: s.en.map(e => e.text), japanese: [s.original] }))
            : [...base];
        return shortestFirst ? kept.sort((a, b) => a.original.length - b.original.length) : kept;
    }, [base, query, shortestFirst]);

    const sortToggle = (
        <TextButton onClick={() => setShortestFirst(!shortestFirst)} ariaPressed={shortestFirst} className={shortestFirst ? 'font-semibold' : ''}>
            Shortest first
        </TextButton>
    );

    return (
        <div>
            {filtered && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
                    <p className="type-support">
                        Pattern: <span lang="ja" className="font-mincho text-base text-primary">{patternText}</span>
                    </p>
                    {onClearPattern && <TextButton onClick={onClearPattern}>Clear</TextButton>}
                </div>
            )}
            {panel.searchable(base.length)
                ? <PanelSearch
                    text={panel.text}
                    onChange={panel.setText}
                    label="Search the sentences"
                    placeholder="Search in English or Japanese"
                    countLine={resultCountLine(matched.length, base.length, 'sentence', query)}
                    aside={sortToggle}
                />
                // Every sentence fits on one page: no search, but the sort still reorders them, at the right as beside the field.
                : base.length > 1 && <div className="flex justify-end mb-4">{sortToggle}</div>}
            <div className="space-y-4">
                {matched.slice(0, panel.shown()).map(sentence => <WordSentence key={sentence.id} vocabId={vocabId} sentence={sentence} query={query} />)}
            </div>
            <ShowMore panel={panel} total={matched.length} className="mt-4" />
        </div>
    );
}
