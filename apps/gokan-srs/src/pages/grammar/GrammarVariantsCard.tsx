import { useEffect, useState } from "react";
import { JlptChip } from "../../components/JlptChip";
import type { GrammarPoint } from "../../models/grammar.model";
import { GrammarService } from "../../services/grammar.service";
import { RelatedEntriesCard, type RelatedEntry } from "../../components/RelatedEntriesCard";

interface Props {
    point: GrammarPoint;
}

/**
 * Friendly labels for a variant member's relation to the canonical. The
 * canonical is the form the SRS actually schedules; the others are realizations
 * of it, rotated onto the canonical's card and graded interchangeably.
 */
const RELATION_LABELS: Record<string, string> = {
    canonical: "Base form",
    contraction: "Contraction",
    politeness: "Politeness",
    particle: "Particle",
    "particle+politeness": "Particle + politeness",
};

interface VariantRow {
    point: GrammarPoint;
    relation: string;
}

/**
 * Surfaces a grammar point's realization variants: the other surface forms of
 * the SAME point, which are studied together on the canonical's single card and
 * graded interchangeably. From a variant (じゃ) it links to the canonical
 * (それでは) and the sibling realizations; from the canonical it links to every
 * realization. This is the relationship that was invisible on the detail page
 * before - GrammarRelatedPointsCard only covers the near-synonym family, a
 * different thing entirely. Rendered through the shared RelatedEntriesCard so it
 * matches the vocab detail page's related-entry lists.
 */
export function GrammarVariantsCard({ point }: Props) {
    const [rows, setRows] = useState<VariantRow[]>([]);

    // A variant points at its canonical; a canonical heads its own group.
    const canonicalId = point.variantOf ?? point.id;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const groups = await GrammarService.loadVariantGroups();
            const group = groups[canonicalId];
            if (!group) {
                if (!cancelled) setRows([]);
                return;
            }
            // Every OTHER member of the group - the current point is the page you are on.
            const others = group.filter(m => m.id !== point.id);
            const loaded = await Promise.all(
                others.map(async m => {
                    const p = await GrammarService.loadGrammarPoint(m.id).catch(() => null);
                    return p ? { point: p, relation: m.relation } : null;
                })
            );
            if (!cancelled) setRows(loaded.filter((r): r is VariantRow => r !== null));
        };
        load();
        return () => { cancelled = true; };
    }, [point.id, canonicalId]);

    if (rows.length === 0) {
        return null;
    }

    const entries: RelatedEntry[] = rows.map(({ point: p, relation }) => ({
        key: p.id,
        to: `/grammar/${p.id}`,
        primary: p.title,
        secondary: (
            <>
                <span className="px-2 py-0.5 text-xs rounded border border-secondary/30 text-secondary font-gothic font-medium whitespace-nowrap">
                    {RELATION_LABELS[relation] ?? relation}
                </span>
                <JlptChip level={p.jlptLevel} />
            </>
        ),
    }));

    return (
        <RelatedEntriesCard
            title="Other forms"
            count={entries.length}
            sections={[{ entries }]}
        />
    );
}
