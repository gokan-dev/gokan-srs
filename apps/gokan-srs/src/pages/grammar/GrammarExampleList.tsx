import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { GrammarExample } from "@gokan/dataset-schema";
import { InteractiveSentence } from "../../components/InteractiveSentence";
import { SentenceWithPlay } from "../../components/PlayButton";
import { Marked } from "../../components/ui/Marked";
import { grammarExampleToSentence, patternHighlightRanges } from "@gokan/dataset-schema";
import { englishRanges, matchesExploreQuery, resultCountLine, type ExploreQuery } from "../../utils/exploreSearch.utils";
import { vocabPath } from "../../utils/navigation.utils";
import { PanelSearch } from "../../components/search/PanelSearch";
import { ShowMore } from "../../components/search/ShowMore";
import { usePagedPanel } from "../../components/search/usePagedPanel";

/** Where an example comes from: written for the point, or found in the sentence corpus (the review pool). */
export type ExampleSource = 'curated' | 'corpus';

export interface ListedExample {
    example: GrammarExample;
    source: ExampleSource;
}

const SOURCE_LABEL: Record<ExampleSource, string> = {
    curated: 'Curated example',
    corpus: 'From the corpus',
};

/** A grammar point's Examples tab, 10 at a time. */
const PAGE = 10;

/**
 * Example sentences on a grammar point's page: each word links to its vocab page, the point's
 * pattern is highlighted in accent (the current item), with romaji and its source, then the
 * translation (a search's matches marked in it).
 */
export function GrammarExampleList({ examples, query = null }: { examples: readonly ListedExample[]; query?: ExploreQuery | null }) {
    const navigate = useNavigate();
    return (
        // Spaced, not ruled, like a word page's examples: nothing draws a line inside a level.
        <div className="space-y-4">
            {examples.map(({ example, source }, i) => (
                <div key={`${source}-${i}-${example.jp}`} data-example-sentence>
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
                    <p className="type-meta mt-1">{[example.romaji, SOURCE_LABEL[source]].filter(Boolean).join(' · ')}</p>
                    <p className="type-support"><Marked text={example.en} ranges={englishRanges(query, example.en)} /></p>
                </div>
            ))}
        </div>
    );
}

/** Every example of a point, curated and from the corpus, searchable in English or Japanese, `pageSize` at a time. */
export function GrammarExamplesPanel({ examples, pageSize = PAGE }: { examples: readonly ListedExample[]; pageSize?: number }) {
    const panel = usePagedPanel(pageSize);
    const { query } = panel;
    const matched = useMemo(
        () => (query ? examples.filter(({ example }) => matchesExploreQuery(query, { english: [example.en], japanese: [example.jp] })) : examples),
        [examples, query],
    );
    return (
        <div>
            {panel.searchable(examples.length) && <PanelSearch
                text={panel.text}
                onChange={panel.setText}
                label="Search the examples"
                placeholder="Search in English or Japanese"
                countLine={resultCountLine(matched.length, examples.length, 'example', query)}
            />}
            <GrammarExampleList examples={matched.slice(0, panel.shown())} query={query} />
            <ShowMore panel={panel} total={matched.length} className="mt-4" />
        </div>
    );
}
