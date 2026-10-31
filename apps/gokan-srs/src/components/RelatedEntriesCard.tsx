import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ListRow } from "./ui/ListRow";
import { TextButton } from "./ui/TextButton";
import { DetailSection } from "./detail/DetailSection";
import type { LookupTarget } from "../utils/lookup.utils";

/**
 * One related entry: a Japanese label, an optional inline secondary (a reading,
 * a relation), an optional trailing status, and an optional one-line gloss.
 */
export interface RelatedEntry {
    key: string;
    to: string;
    /** Japanese text (a word's headword, a grammar point's title). */
    primary: string;
    /** Inline, right after the primary: a reading, a relation. Several parts as a fragment, so each wraps on its own. */
    secondary?: ReactNode;
    /** Right-aligned: the entry's status. */
    trailing?: ReactNode;
    /** A gloss or definition line beneath: one line, cut off, unless the list's `wrapDescription` lets it wrap. Text, with any search match marked. */
    description?: ReactNode;
    /** The word the row names, for its lookup card. */
    lookup?: LookupTarget;
}

export interface RelatedSection {
    /** A label above the rows ("Built from"). Omit for a single unlabelled list. */
    label?: string;
    count?: number;
    entries: RelatedEntry[];
    /** Under the rows: how many the section leaves out, or the action that shows them. */
    footer?: ReactNode;
}

interface Props {
    title: string;
    /** An anchor other pages link to (DetailSection). */
    id?: string;
    /** Shown next to the title. Omit when per-section labels carry the counts instead. */
    count?: number;
    /** An action link under the heading (grammar's "Compare when to use each"). */
    headerLink?: { to: string; label: string };
    /** Prose above the rows (grammar's differentiator). */
    intro?: ReactNode;
    sections: RelatedSection[];
    /** Expand/collapse is controlled by the caller so it can lazy-load only the displayed rows. */
    isExpandable?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    expandLabel?: string;
    collapseLabel?: string;
}

/**
 * The one "related entries" section, so a word's relationships and a grammar
 * point's similar points and other forms share one row layout and expand
 * control. Callers resolve their own data and map it to rows.
 */
export function RelatedEntriesCard({
    title,
    id,
    count,
    headerLink,
    intro,
    sections,
    isExpandable = false,
    isExpanded = false,
    onToggleExpand,
    expandLabel = "Show all",
    collapseLabel = "Show fewer",
}: Props) {
    return (
        <DetailSection title={title} count={count} id={id}>
            {intro && <div className="mb-4">{intro}</div>}

            {headerLink && (
                <Link
                    to={headerLink.to}
                    className="inline-flex items-center gap-1 mb-3 font-sans text-sm text-accent hover:underline"
                >
                    {headerLink.label} <ArrowRight size={14} aria-hidden="true" />
                </Link>
            )}

            <RelatedEntryList sections={sections} />

            {isExpandable && onToggleExpand && (
                <TextButton onClick={onToggleExpand} className="mt-3">
                    {isExpanded ? collapseLabel : expandLabel}
                </TextButton>
            )}
        </DetailSection>
    );
}

/**
 * The rows of related entries, in labelled groups, without a section around them: the card
 * above, and a word page's Explore panels, which have a heading of their own.
 */
export function RelatedEntryList({ sections, wrapDescription = false }: {
    sections: RelatedSection[];
    /** Wrap each row's description instead of cutting it to one line: for a list whose description is the row's content (Synonyms' shared senses). */
    wrapDescription?: boolean;
}) {
    return (
        <div className="space-y-5">
            {sections.map((section, i) => (
                <div key={section.label ?? i}>
                    {section.label && (
                        <h3 className="type-label mb-1">
                            {section.label}
                            {section.count !== undefined && <span className="type-meta ml-2 tabular-nums">{section.count.toLocaleString('en-US')}</span>}
                        </h3>
                    )}
                    <div className="flex flex-col -mx-3">
                        {section.entries.map(entry => (
                            <ListRow key={entry.key} to={entry.to} trailing={entry.trailing} lookup={entry.lookup}>
                                {/* One wrapping line: what does not fit after the headword starts again at the row's edge. */}
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                                    <span className="font-mincho text-lg text-primary shrink-0">{entry.primary}</span>
                                    {entry.secondary}
                                </div>
                                {entry.description && <div className={`type-support ${wrapDescription ? 'break-words' : 'truncate'}`}>{entry.description}</div>}
                            </ListRow>
                        ))}
                    </div>
                    {section.footer && <div className="mt-1">{section.footer}</div>}
                </div>
            ))}
        </div>
    );
}
