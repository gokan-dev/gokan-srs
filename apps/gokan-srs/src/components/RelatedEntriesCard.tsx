import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "./ui/Card";
import { useResponsive } from "../context/Responsive/useResponsive";

/**
 * One clickable row: a Japanese primary label, an optional inline secondary
 * (a reading, a JLPT chip, a relation chip - whatever the caller supplies), an
 * optional right-aligned meta (an id), and an optional description below.
 */
export interface RelatedEntry {
    key: string;
    to: string;
    /** Japanese text (a word's kanji form, a grammar point's title). */
    primary: string;
    /** Inline, right after the primary - a reading string, a <JlptChip/>, etc. */
    secondary?: ReactNode;
    /** Right-aligned on the primary row (e.g. an id). */
    meta?: ReactNode;
    /** A gloss/definition line beneath the primary row, clamped to two lines. */
    description?: string;
}

export interface RelatedSection {
    /** Small uppercase label above the rows (e.g. "Consists of (3)"). Omit for a single unlabelled list. */
    label?: string;
    entries: RelatedEntry[];
}

interface Props {
    title: string;
    /** Shown as "(N)" next to the title. Omit when per-section labels carry the counts instead. */
    count?: number;
    /** An action link under the heading (e.g. grammar's "Compare when to use each"). */
    headerLink?: { to: string; label: string };
    sections: RelatedSection[];
    /** Primary text size - vocab kanji reads larger than a grammar title. */
    primarySize?: "lg" | "xl";
    /** Expand/collapse is controlled by the caller so it can lazy-load only the displayed rows. Omit for a fixed short list. */
    isExpandable?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    expandLabel?: string;
    collapseLabel?: string;
}

/**
 * The single presentational base behind every "related entries" list in the
 * app, so a vocab word's relationships and a grammar point's related/variant
 * links share one card chrome, row layout, hover treatment, and expand control.
 * Callers resolve their own data and map it to RelatedEntry rows; everything
 * visual lives here. Used by VocabRelationshipsCard, GrammarRelatedPointsCard,
 * and GrammarVariantsCard.
 */
export function RelatedEntriesCard({
    title,
    count,
    headerLink,
    sections,
    primarySize = "lg",
    isExpandable = false,
    isExpanded = false,
    onToggleExpand,
    expandLabel = "Show all",
    collapseLabel = "Show fewer",
}: Props) {
    const { isMobile } = useResponsive();
    const navigate = useNavigate();

    const primaryClass = primarySize === "xl" ? "text-xl" : "text-lg";

    const renderEntries = (entries: RelatedEntry[]) => (
        <div className="space-y-3 mt-2">
            {entries.map((entry) => (
                <div
                    key={entry.key}
                    onClick={() => navigate(entry.to)}
                    className="border-l-2 border-divider pl-3 cursor-pointer hover:border-accent transition-colors group"
                >
                    <div className={`flex items-center gap-2 ${entry.description ? "mb-1" : ""}`}>
                        <span className={`font-mincho ${primaryClass} text-primary group-hover:text-accent transition-colors`}>
                            {entry.primary}
                        </span>
                        {entry.secondary}
                        {entry.meta && <span className="ml-auto">{entry.meta}</span>}
                    </div>
                    {entry.description && (
                        <div className="text-sm text-meaning-muted font-serif line-clamp-2">
                            {entry.description}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <Card size={isMobile ? "sm" : "md"}>
            <h2 className="text-lg font-gothic font-semibold text-primary mb-4">
                {title}
                {count !== undefined && (
                    <span className="text-sm font-normal text-tertiary ml-2">({count})</span>
                )}
            </h2>

            {headerLink && (
                <Link
                    to={headerLink.to}
                    className="inline-flex items-center gap-1 mb-4 text-sm font-gothic text-accent hover:underline"
                >
                    {headerLink.label} <ArrowRight size={14} />
                </Link>
            )}

            <div className="space-y-6">
                {sections.map((section, i) => (
                    <div
                        key={section.label ?? i}
                        className={i > 0 ? "pt-4 border-t border-divider/50" : ""}
                    >
                        {section.label && (
                            <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-2">
                                {section.label}
                            </div>
                        )}
                        {renderEntries(section.entries)}
                    </div>
                ))}
            </div>

            {isExpandable && onToggleExpand && (
                <div className="mt-6 text-center">
                    <button
                        onClick={onToggleExpand}
                        className="text-sm font-gothic text-accent hover:text-accent/80 transition-colors py-2 px-4 rounded-md border border-accent/20 hover:bg-accent/5 w-full md:w-auto"
                    >
                        {isExpanded ? collapseLabel : expandLabel}
                    </button>
                </div>
            )}
        </Card>
    );
}
