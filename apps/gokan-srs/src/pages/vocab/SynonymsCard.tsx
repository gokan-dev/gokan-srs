import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { RelatedEntriesCard } from "../../components/RelatedEntriesCard";
import type { RelatedSection } from "../../components/RelatedEntriesCard";
import { SecondaryForm } from "../../components/SecondaryForm";
import { TagChip } from "../../components/TagChip";
import { useQuiz } from "../../context/useQuiz";
import { CLOSENESS_LABEL, closenessOf, listedSynonymsOf } from "../../services/exercise/wordRelation";
import type { Closeness } from "../../services/exercise/wordRelation";
import { mixedUpLabel, mixupCounts } from "../../utils/mixups.utils";
import { SYNONYMS_HASH } from "../../utils/navigation.utils";
import { hasMoreSynonyms, shownSections, synonymSections } from "../../utils/synonymSections.utils";

const ANCHOR = SYNONYMS_HASH.slice(1);

/** How close two words are, as a neutral chip told apart by its sign and its word, never a colour. */
function ClosenessChip({ closeness }: { closeness: Closeness }) {
    const { sign, label } = CLOSENESS_LABEL[closeness];
    return (
        <TagChip size="sm">
            <span aria-hidden="true" className="mr-1 font-sans">{sign}</span>
            {label}
        </TagChip>
    );
}

/**
 * A word's synonyms from the dataset, one section per sense they share, best first and
 * capped (utils/synonymSections.utils.ts), each labelled by how close the two words
 * are, as grading reads the pair (closenessOf). Absent when the word has none.
 * Anchored as `synonyms`, where a quiz's synonym note links.
 */
export function SynonymsCard({ vocab }: { vocab: Vocabulary }) {
    const { state } = useQuiz();
    const { hash } = useLocation();
    // Expansion belongs to one word: keyed by it, so another word's card starts collapsed.
    const [expandedFor, setExpandedFor] = useState<string | null>(null);
    const expanded = expandedFor === vocab.id;

    const queue = state.progress?.learningQueue;
    const records = state.progress?.mixups;
    const mixedUp = useMemo(() => mixupCounts(records, vocab.id), [records, vocab.id]);
    const sections = useMemo(() => {
        const studied = new Set((queue ?? []).map(v => v.vocabId));
        return synonymSections(vocab.senses, listedSynonymsOf(vocab), { studied, mixedUp });
    }, [vocab, queue, mixedUp]);

    // The router does not scroll to a hash, and the card renders after the word loads.
    const linkedHere = hash === SYNONYMS_HASH && sections.length > 0;
    useEffect(() => {
        if (linkedHere) document.getElementById(ANCHOR)?.scrollIntoView({ block: 'start' });
    }, [linkedHere, vocab.id]);

    if (sections.length === 0) return null;
    const headword = headwordOf(vocab);

    const shown: RelatedSection[] = shownSections(sections, expanded, mixedUp).map(section => ({
        label: section.glosses.join('; '),
        count: section.words.length,
        ...(expanded && section.hidden > 0 ? { note: `${section.hidden.toLocaleString('en-US')} more not shown` } : {}),
        entries: section.shown.map(synonym => {
            const times = mixedUp.get(synonym.vocabId);
            return {
                key: synonym.vocabId,
                to: `/vocab/${synonym.vocabId}`,
                primary: headwordOf(synonym.forms),
                // The reading is never broken: on a narrow row the chip drops under it.
                secondary: (
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                        <SecondaryForm vocab={synonym.forms} truncate={false} />
                        <ClosenessChip closeness={closenessOf(synonym.pair, section.glosses)} />
                    </span>
                ),
                ...(times ? { trailing: <span className="type-meta tabular-nums">{mixedUpLabel(times)}</span> } : {}),
                ...(synonym.shared.length > 0 ? { description: synonym.shared.join(', ') } : {}),
            };
        }),
    }));

    return (
        <RelatedEntriesCard
            id={ANCHOR}
            title="Synonyms"
            intro={(
                <p className="type-support">
                    Typing one of these on a <span lang="ja" className="font-mincho">{headword}</span> card costs nothing: it is accepted when it fits the card's meaning, and <span lang="ja" className="font-mincho">{headword}</span> is asked again.
                </p>
            )}
            sections={shown}
            isExpandable={hasMoreSynonyms(sections, mixedUp)}
            isExpanded={expanded}
            onToggleExpand={() => setExpandedFor(expanded ? null : vocab.id)}
            expandLabel="Show all synonyms"
            collapseLabel="Show fewer synonyms"
        />
    );
}
