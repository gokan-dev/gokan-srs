import { useMemo } from "react";
import { DetailSection } from "../../components/detail/DetailSection";
import type { MixupRecord } from "../../models/mixup.model";
import type { VocabProgress } from "../../models/vocabulary.model";
import { matchesExploreQuery, resultCountLine } from "../../utils/exploreSearch.utils";
import { PanelSearch } from "./explore/PanelSearch";
import { usePanelQuery } from "./explore/usePanelQuery";
import { YourMixups } from "./YourMixups";
import { YourStudy } from "./YourStudy";

interface StudyTabProps {
    vocabId: string;
    progress: VocabProgress & { introductionAt: Date };
    now: number;
    /** The records where this word was asked, newest first (mixupsAsked). */
    mixups: readonly MixupRecord[];
}

/** A studied word's tab: Your study, then Your mix-ups when the learner has made any on its cards. */
export function StudyTab({ vocabId, progress, now, mixups }: StudyTabProps) {
    return (
        <div className="space-y-10">
            <YourStudy progress={progress} now={now} />
            {mixups.length > 0 && (
                <DetailSection title="Your mix-ups">
                    <MixupsPanel vocabId={vocabId} records={mixups} />
                </DetailSection>
            )}
        </div>
    );
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
