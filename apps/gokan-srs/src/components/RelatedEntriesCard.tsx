import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ListRow } from "./ui/ListRow";
import { DetailSection } from "./detail/DetailSection";

/**
 * One related entry: a Japanese label, an optional inline secondary (a reading,
 * a relation), an optional trailing status, and an optional one-line gloss.
 */
export interface RelatedEntry {
    key: string;
    to: string;
    /** Japanese text (a word's headword, a grammar point's title). */
    primary: string;
    /** Inline, right after the primary: a reading, a relation. */
    secondary?: ReactNode;
    /** Right-aligned: the entry's status. */
    trailing?: ReactNode;
    /** A gloss or definition line beneath, one line. */
    description?: string;
}

export interface RelatedSection {
    /** A label above the rows ("Built from"). Omit for a single unlabelled list. */
    label?: string;
    count?: number;
    entries: RelatedEntry[];
}

interface Props {
    title: string;
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
        <DetailSection title={title} count={count}>
            {intro && <div className="mb-4">{intro}</div>}

            {headerLink && (
                <Link
                    to={headerLink.to}
                    className="inline-flex items-center gap-1 mb-3 font-sans text-sm text-accent hover:underline"
                >
                    {headerLink.label} <ArrowRight size={14} aria-hidden="true" />
                </Link>
            )}

            <div className="space-y-5">
                {sections.map((section, i) => (
                    <div key={section.label ?? i}>
                        {section.label && (
                            <h3 className="type-label mb-1">
                                {section.label}
                                {section.count !== undefined && <span className="type-meta ml-2 tabular-nums">{section.count}</span>}
                            </h3>
                        )}
                        <div className="flex flex-col -mx-3">
                            {section.entries.map(entry => (
                                <ListRow key={entry.key} to={entry.to} trailing={entry.trailing}>
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <span className="font-mincho text-lg text-primary shrink-0">{entry.primary}</span>
                                        {entry.secondary}
                                    </div>
                                    {entry.description && <div className="type-support truncate">{entry.description}</div>}
                                </ListRow>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {isExpandable && onToggleExpand && (
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className="mt-3 font-sans text-sm text-accent hover:underline cursor-pointer"
                >
                    {isExpanded ? collapseLabel : expandLabel}
                </button>
            )}
        </DetailSection>
    );
}
