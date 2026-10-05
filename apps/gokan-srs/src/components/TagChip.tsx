import type { ReactNode } from "react";

/** A small accent label (part of speech, word type) beside a JLPT chip. */
export function TagChip({ children, size = 'md' }: { children: ReactNode; size?: 'sm' | 'md' }) {
    const sizing = size === 'sm' ? 'px-1.5 py-0.5 text-[9px] whitespace-nowrap' : 'px-2 py-0.5 text-xs';
    return (
        <span className={`${sizing} rounded bg-accent/10 text-accent font-gothic font-medium dark:bg-accent/15`}>
            {children}
        </span>
    );
}
