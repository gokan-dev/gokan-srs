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
 * The page's inline padding, set once here as `--page-inset` so a child that bleeds to the page's
 * edges (a word page's sticky tab row, its scrolling tablist) undoes exactly this padding: change
 * it here and they follow, with no gutter and no sideways scroll.
 */
const PAGE_INSET = '[--page-inset:1rem] md:[--page-inset:1.5rem] px-(--page-inset)';

/** Pulls an element out over the page's padding to its edges. */
export const PAGE_BLEED = '-mx-(--page-inset)';

/** Puts the page's padding back inside a bled element (and its scroll padding), so its content lines up with the page's. */
export const PAGE_BLEED_INSET = 'px-(--page-inset) scroll-px-(--page-inset)';

/**
 * The one page frame: a content width, top padding, and bottom padding that
 * clears the mobile bottom tab bar. Every routed page uses this except the
 * quiz sessions (their own centred layout) and onboarding.
 */
export function Page({ width, children, className = '', data }: PageProps) {
    const maxWidth = width === 'wide' ? 'max-w-5xl' : 'max-w-3xl';
    return (
        <div {...data} className={`w-full ${maxWidth} mx-auto ${PAGE_INSET} pt-6 md:pt-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12 ${className}`}>
            {children}
        </div>
    );
}
