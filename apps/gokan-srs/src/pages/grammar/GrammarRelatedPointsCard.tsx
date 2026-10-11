import { useState } from "react";
import type { GrammarPoint } from "@gokan/dataset-schema";
import { GrammarDifferentiator } from "../../components/GrammarDifferentiator";
import { StatusDot } from "../../components/StatusDot";
import { useQuiz } from "../../context/useQuiz";
import { useIntroducedGrammarIds } from "../../hooks/useIntroducedGrammarIds";
import { grammarLearningStatus } from "../../utils/learningStatus.utils";
import { GrammarService } from "../../services/grammar.service";
import { RelatedEntriesCard, type RelatedEntry } from "../../components/RelatedEntriesCard";
import { useAsyncData } from "../../hooks/useAsyncData";

interface Props {
    point: GrammarPoint;
}

const INITIAL_COUNT = 5;

/**
 * "Similar grammar": the point's near-synonym family (same core idea at a
 * different formality or nuance). What separates them (GrammarDifferentiator,
 * inline) comes first, then the points themselves with the learner's status.
 * Realization variants (the SAME point written differently) are a different
 * relationship, in GrammarVariantsCard.
 */
export function GrammarRelatedPointsCard({ point }: Props) {
    const { state } = useQuiz();
    const knownIds = useIntroducedGrammarIds();
    // Expansion belongs to one point: keyed by it, so another point's card starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const isExpanded = expandedFor === point.id;
    const setIsExpanded = (expanded: boolean) => setExpandedFor(expanded ? point.id : null);

    const relatedIds = point.family?.relatedPoints || [];
    const familyId = point.family?.id;

    // Only surface the "compare when to use each" link when this family actually
    // has situational lessons authored (issue #62) - otherwise the family page
    // would just show its empty-state.
    const hasContrasts = useAsyncData(familyId ?? null, async () => Boolean((await GrammarService.loadContrasts())[familyId ?? ''])).data ?? false;

    const isExpandable = relatedIds.length > INITIAL_COUNT;
    const displayedIds = isExpanded ? relatedIds : relatedIds.slice(0, INITIAL_COUNT);

    const related: GrammarPoint[] = useAsyncData(displayedIds.join(','), () => GrammarService.loadGrammarPoints(displayedIds), { keepPrevious: true }).data ?? [];

    if (relatedIds.length === 0) {
        return null;
    }

    const entries: RelatedEntry[] = related.map(p => ({
        key: p.id,
        to: `/grammar/${p.id}`,
        primary: p.title,
        description: p.shortExplanation,
        trailing: <StatusDot status={grammarLearningStatus(state.progress?.grammarQueue.find(g => g.grammarId === p.id))} />,
    }));

    return (
        <RelatedEntriesCard
            title="Similar grammar"
            intro={<GrammarDifferentiator point={point} knownIds={knownIds} inline />}
            headerLink={hasContrasts && familyId ? { to: `/grammar/family/${familyId}`, label: "Compare when to use each" } : undefined}
            sections={[{ entries }]}
            isExpandable={isExpandable}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandLabel={`Show all ${relatedIds.length}`}
            collapseLabel="Show fewer"
        />
    );
}
