import type { ReactNode } from "react";

interface DetailSectionProps {
    title: ReactNode;
    /** Shown after the title, e.g. how many items the section lists. */
    count?: number;
    children: ReactNode;
    className?: string;
    /** An anchor other pages link to (a word's `synonyms`). */
    id?: string;
}

/** One section of a detail page: a heading and its content, not a card. */
export function DetailSection({ title, count, children, className = '', id }: DetailSectionProps) {
    return (
        <section id={id} className={`scroll-mt-6 ${className}`}>
            <h2 className="type-section mb-4">
                {title}
                {count !== undefined && <span className="type-meta ml-2 tabular-nums">{count.toLocaleString('en-US')}</span>}
            </h2>
            {children}
        </section>
    );
}

/** A labelled value inside a detail section. */
export function DetailField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="type-label">{label}</dt>
            <dd className="type-body">{children}</dd>
        </div>
    );
}
