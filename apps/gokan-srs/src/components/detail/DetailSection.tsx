import type { ReactNode } from "react";

interface DetailSectionProps {
    title: ReactNode;
    /** Shown after the title, e.g. how many items the section lists. */
    count?: number;
    /** On the heading's line, at its right: an action ("All 1,030 sentences →") or a meta line. */
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
    /** An anchor other pages link to (a word's `explore`). */
    id?: string;
}

/** One section of a detail page: a heading and its content, not a card. */
export function DetailSection({ title, count, aside, children, className = '', id }: DetailSectionProps) {
    const heading = (
        <h2 className={`type-section ${aside ? '' : 'mb-4'}`}>
            {title}
            {count !== undefined && <span className="type-meta ml-2 tabular-nums">{count.toLocaleString('en-US')}</span>}
        </h2>
    );
    return (
        <section id={id} className={`scroll-mt-6 ${className}`}>
            {aside ? (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
                    {heading}
                    {aside}
                </div>
            ) : heading}
            {children}
        </section>
    );
}

interface DetailFieldProps {
    label: string;
    children: ReactNode;
    /** A header's facts row (a word's How common, KKLC step): `type-meta` over `type-value`, side by side with others. */
    compact?: boolean;
}

/** A labelled value inside a detail section, or, compact, one fact of a header's facts row. */
export function DetailField({ label, children, compact = false }: DetailFieldProps) {
    return (
        <div className={compact ? 'min-w-0' : ''}>
            <dt className={compact ? 'type-meta' : 'type-label'}>{label}</dt>
            <dd className={compact ? 'type-value' : 'type-body'}>{children}</dd>
        </div>
    );
}
