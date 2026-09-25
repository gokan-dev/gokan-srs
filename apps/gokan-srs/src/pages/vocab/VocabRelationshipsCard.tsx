import { useEffect, useState } from "react";
import type { Vocabulary } from "../../models/vocabulary.model";
import { VocabularyService } from "../../services/vocabulary.service";
import { RelatedEntriesCard, type RelatedEntry, type RelatedSection } from "../../components/RelatedEntriesCard";

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
    const [parents, setParents] = useState<Vocabulary[]>([]);
    const [components, setComponents] = useState<Vocabulary[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const componentIds = vocab.components || [];
    const parentIds = vocab.parents || [];

    const isExpandable = componentIds.length > INITIAL_COUNT || parentIds.length > INITIAL_COUNT;
    const displayedComponentIds = isExpanded ? componentIds : componentIds.slice(0, INITIAL_COUNT);
    const displayedParentIds = isExpanded ? parentIds : parentIds.slice(0, INITIAL_COUNT);

    // Reset expansion when navigating to a different word.
    useEffect(() => {
        setIsExpanded(false);
    }, [vocab.id]);

    // Load only the currently displayed ids, re-loading when expanded.
    useEffect(() => {
        const load = async () => {
            if (displayedComponentIds.length > 0) {
                const c = await Promise.all(displayedComponentIds.map(id => VocabularyService.loadVocab(id).catch(() => null)));
                setComponents(c.filter((v): v is Vocabulary => v !== null));
            } else {
                setComponents([]);
            }
            if (displayedParentIds.length > 0) {
                const p = await Promise.all(displayedParentIds.map(id => VocabularyService.loadVocab(id).catch(() => null)));
                setParents(p.filter((v): v is Vocabulary => v !== null));
            } else {
                setParents([]);
            }
        };
        load();
    }, [isExpanded, vocab]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onToggleExpand={() => setIsExpanded(v => !v)}
            expandLabel="Show all relationships"
            collapseLabel="Show fewer relationships"
        />
    );
}
