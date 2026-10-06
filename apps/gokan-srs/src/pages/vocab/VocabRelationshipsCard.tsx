import { useState } from "react";
import type { Vocabulary } from "@gokan/dataset-schema";
import { VocabularyService } from "../../services/vocabulary.service";
import { RelatedEntriesCard, type RelatedEntry, type RelatedSection } from "../../components/RelatedEntriesCard";
import { useAsyncData } from "../../hooks/useAsyncData";

interface Props {
    vocab: Vocabulary;
}

const INITIAL_COUNT = 5;

function toEntry(v: Vocabulary): RelatedEntry {
    return {
        key: v.id,
        to: `/vocab/${v.id}`,
        primary: v.writtenForm.kanji,
        secondary: <span className="font-gothic font-bold text-secondary">{v.reading.primary}</span>,
        meta: <span className="text-xs text-tertiary font-mono">ID: {v.id}</span>,
        description: v.senses && v.senses[0] ? v.senses[0].glosses.join(", ") : "No definition available",
    };
}

/**
 * A word's relationships (the vocab it consists of, and the derived words it is
 * used in), rendered through the shared RelatedEntriesCard so it matches the
 * grammar detail page's related/variant lists exactly.
 */
export function VocabRelationshipsCard({ vocab }: Props) {
    // Expansion belongs to one word: keyed by it, so another word's card starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const isExpanded = expandedFor === vocab.id;
    const setIsExpanded = (expanded: boolean) => setExpandedFor(expanded ? vocab.id : null);

    const componentIds = vocab.components || [];
    const parentIds = vocab.parents || [];

    const isExpandable = componentIds.length > INITIAL_COUNT || parentIds.length > INITIAL_COUNT;
    const displayedComponentIds = isExpanded ? componentIds : componentIds.slice(0, INITIAL_COUNT);
    const displayedParentIds = isExpanded ? parentIds : parentIds.slice(0, INITIAL_COUNT);

    // Load only the currently displayed ids; expanding loads the rest.
    const components = useAsyncData(displayedComponentIds.join(','), () => VocabularyService.loadVocabs(displayedComponentIds), { keepPrevious: true }).data ?? [];
    const parents = useAsyncData(displayedParentIds.join(','), () => VocabularyService.loadVocabs(displayedParentIds), { keepPrevious: true }).data ?? [];

    if (componentIds.length === 0 && parentIds.length === 0) {
        return null;
    }

    const sections: RelatedSection[] = [];
    if (componentIds.length > 0) {
        sections.push({ label: `Consists of (${componentIds.length})`, entries: components.map(toEntry) });
    }
    if (parentIds.length > 0) {
        sections.push({ label: `Used in Derived Words (${parentIds.length})`, entries: parents.map(toEntry) });
    }

    return (
        <RelatedEntriesCard
            title="Relationships"
            sections={sections}
            primarySize="xl"
            isExpandable={isExpandable}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandLabel="Show all relationships"
            collapseLabel="Show fewer relationships"
        />
    );
}
