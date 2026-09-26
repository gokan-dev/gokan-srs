import { useEffect, useState } from "react";
import { JlptChip } from "../../components/JlptChip";
import type { GrammarPoint } from "../../models/grammar.model";
import { GrammarService } from "../../services/grammar.service";
import { RelatedEntriesCard, type RelatedEntry } from "../../components/RelatedEntriesCard";

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
    const [related, setRelated] = useState<GrammarPoint[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasContrasts, setHasContrasts] = useState(false);

    const relatedIds = point.family?.relatedPoints || [];
    const familyId = point.family?.id;

    // Only surface the "compare when to use each" link when this family actually
    // has situational lessons authored (issue #62) - otherwise the family page
    // would just show its empty-state.
    useEffect(() => {
        if (!familyId) return;
        let cancelled = false;
        GrammarService.loadContrasts().then(index => {
            if (!cancelled) setHasContrasts(Boolean(index[familyId]));
        });
        return () => { cancelled = true; };
    }, [familyId]);

    const isExpandable = relatedIds.length > INITIAL_COUNT;
    const displayedIds = isExpanded ? relatedIds : relatedIds.slice(0, INITIAL_COUNT);

    useEffect(() => {
        setIsExpanded(false);
    }, [point.id]);

    useEffect(() => {
        const load = async () => {
            if (displayedIds.length === 0) {
                setRelated([]);
                return;
            }
            const points = await Promise.all(displayedIds.map(id => GrammarService.loadGrammarPoint(id).catch(() => null)));
            setRelated(points.filter((p): p is GrammarPoint => p !== null));
        };
        load();
    }, [isExpanded, point]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onToggleExpand={() => setIsExpanded(v => !v)}
            expandLabel="Show all related points"
            collapseLabel="Show fewer related points"
        />
    );
}
