import type { ReactNode } from "react";

interface PageProps {
    /** `wide` (1024px) for list/grid pages and detail pages; `narrow` (768px) for a single reading column. */
    width: 'narrow' | 'wide';
    children: ReactNode;
    className?: string;
    /** `data-` attributes on the frame: a state a browser check waits on (a word page's `data-sentences`). */
    data?: Record<`data-${string}`, string>;
}

/**
 * The one page frame: a content width, top padding, and bottom padding that
 * clears the mobile bottom tab bar. Every routed page uses this except the
 * quiz sessions (their own centred layout) and onboarding.
 */
export function Page({ width, children, className = '', data }: PageProps) {
    const maxWidth = width === 'wide' ? 'max-w-5xl' : 'max-w-3xl';
    return (
        <div {...data} className={`w-full ${maxWidth} mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12 ${className}`}>
            {children}
        </div>
    );
}
