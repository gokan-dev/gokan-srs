import { useState } from "react";
import { JlptChip } from "../../components/JlptChip";
import type { GrammarPoint } from "../../models/grammar.model";
import { GrammarService } from "../../services/grammar.service";
import { RelatedEntriesCard, type RelatedEntry } from "../../components/RelatedEntriesCard";
import { useAsyncData } from "../../hooks/useAsyncData";

interface Props {
    point: GrammarPoint;
}

const INITIAL_COUNT = 5;

/**
 * The point's named near-synonym family (same core idea at a different
 * formality/nuance), rendered through the shared RelatedEntriesCard so it
 * matches the vocab detail page's Relationships list. A separate card,
 * GrammarVariantsCard, handles realization variants (the SAME point written
 * differently), which is a distinct relationship.
 */
export function GrammarRelatedPointsCard({ point }: Props) {
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
        secondary: <JlptChip level={p.jlptLevel} />,
    }));

    return (
        <RelatedEntriesCard
            title={point.family?.name || "Related Points"}
            count={relatedIds.length}
            headerLink={hasContrasts && familyId ? { to: `/grammar/family/${familyId}`, label: "Compare when to use each" } : undefined}
            sections={[{ entries }]}
            isExpandable={isExpandable}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandLabel="Show all related points"
            collapseLabel="Show fewer related points"
        />
    );
}
