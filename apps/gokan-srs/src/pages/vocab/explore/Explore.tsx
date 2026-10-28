import { useMemo } from "react";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { DetailSection } from "../../../components/detail/DetailSection";
import { SegmentedToggle, type Segment } from "../../../components/ui/SegmentedToggle";
import type { MixupRecord } from "../../../models/mixup.model";
import { matchesExploreQuery, resultCountLine } from "../../../utils/exploreSearch.utils";
import { EXPLORE_ANCHOR, SYNONYMS_ANCHOR } from "../../../utils/navigation.utils";
import { synonymCount, type SynonymSection } from "../../../utils/synonymSections.utils";
import { YourMixups } from "../YourMixups";
import { PanelSearch } from "./PanelSearch";
import { usePanelQuery } from "./usePanelQuery";
import { RelatedPanel } from "./RelatedPanel";
import { relatedCount } from "./counts";
import { SentencesPanel } from "./SentencesPanel";
import { SynonymsPanel } from "./SynonymsPanel";

/** A panel, named in the singular: the sentence panel, the synonym panel. */
export type ExplorePanel = 'sentence' | 'synonym' | 'related' | 'mixup';

/** Each panel's id, which its segment controls; the Synonyms one is where `#synonyms` points. */
const PANEL_ID: Record<ExplorePanel, string> = {
    sentence: 'explore-sentences',
    synonym: SYNONYMS_ANCHOR,
    related: 'explore-related',
    mixup: 'explore-mixups',
};

interface ExploreProps {
    vocab: Vocabulary;
    open: ExplorePanel | null;
    onToggle: (panel: ExplorePanel) => void;
    sentences: readonly Sentence[];
    wordSynonyms: { sections: SynonymSection[]; mixedUp: ReadonlyMap<string, number> };
    /** The records where this word was asked, newest first (mixupsAsked). */
    mixups: readonly MixupRecord[];
}

/**
 * A word page's long lists, reached only by asking: one segmented toggle (Sentences, Synonyms,
 * Related, Mix-ups, each only when it has something), one panel open at a time, none on load,
 * each with its own search. Absent when the word has none of them.
 */
export function Explore({ vocab, open, onToggle, sentences, wordSynonyms, mixups }: ExploreProps) {
    const segments: Segment<ExplorePanel>[] = [
        { key: 'sentence' as const, label: 'Sentences', name: 'Example sentences', count: sentences.length },
        { key: 'synonym' as const, label: 'Synonyms', name: 'Synonyms', count: synonymCount(wordSynonyms.sections) },
        { key: 'related' as const, label: 'Related', name: 'Related words', count: relatedCount(vocab) },
        { key: 'mixup' as const, label: 'Mix-ups', name: 'Your mix-ups', count: mixups.length },
    ].filter(s => s.count > 0).map(s => ({ ...s, controls: PANEL_ID[s.key] }));

    if (segments.length === 0) return null;
    const shownOpen = segments.some(s => s.key === open) ? open : null;

    return (
        <DetailSection title="Explore" id={EXPLORE_ANCHOR}>
            <SegmentedToggle segments={segments} open={shownOpen} onToggle={onToggle} label="Explore this word" />
            {shownOpen === null && <p className="type-meta mt-3">Open one to browse it and search in it.</p>}
            {/* Every panel's element is there for its segment's aria-controls; only the open one has content. */}
            {segments.map(({ key }) => (
                <div key={key} id={PANEL_ID[key]} hidden={key !== shownOpen} className="mt-6">
                    {key === shownOpen && <PanelContent panel={key} {...{ vocab, sentences, wordSynonyms, mixups }} />}
                </div>
            ))}
        </DetailSection>
    );
}

function PanelContent({ panel, vocab, sentences, wordSynonyms, mixups }: Omit<ExploreProps, 'open' | 'onToggle'> & { panel: ExplorePanel }) {
    switch (panel) {
        case 'sentence': return <SentencesPanel vocabId={vocab.id} sentences={sentences} />;
        case 'synonym': return <SynonymsPanel vocab={vocab} sections={wordSynonyms.sections} mixedUp={wordSynonyms.mixedUp} />;
        case 'related': return <RelatedPanel vocab={vocab} />;
        case 'mixup': return <MixupsPanel vocabId={vocab.id} records={mixups} />;
    }
}

/** The word's mix-ups (YourMixups, as it is), searchable by what was typed and the card's sentence. */
function MixupsPanel({ vocabId, records }: { vocabId: string; records: readonly MixupRecord[] }) {
    const { text, setText, query } = usePanelQuery();
    const matched = useMemo(
        () => (query ? records.filter(r => matchesExploreQuery(query, { english: [r.cue ?? '', r.meaning ?? ''], japanese: [r.answer] })) : records),
        [records, query],
    );
    return (
        <div>
            <PanelSearch
                text={text}
                onChange={setText}
                label="Search your mix-ups"
                placeholder="Search in English or Japanese"
                countLine={resultCountLine(matched.length, records.length, 'mix-up', query)}
            />
            <YourMixups vocabId={vocabId} records={matched} query={query} />
        </div>
    );
}
