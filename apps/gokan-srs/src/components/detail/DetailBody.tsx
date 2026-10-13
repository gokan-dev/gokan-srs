import type { ReactNode } from "react";
import { useResponsive } from "../../context/Responsive/useResponsive";

interface DetailBodyProps {
    /** The subject's content: meanings, sentences, words, explanations. */
    main: ReactNode;
    /** The learner's data and the dataset's: progress, related items, the details disclosure. */
    side: ReactNode;
    /** The one-column order below `lg`, when it interleaves the two (defaults to main, then side). */
    stacked?: ReactNode;
}

/**
 * The body of a vocab, kanji or grammar page, under its DetailHeader: from `lg` the same 12-column
 * grid (8 for the content, 4 for the side, gap-10), so the side column starts where the header's
 * actions do; below it, one column in reading order. Sections are spaced, not boxed.
 */
export function DetailBody({ main, side, stacked }: DetailBodyProps) {
    const { isMobile, isTablet } = useResponsive();
    if (isMobile || isTablet) return <div className="space-y-10">{stacked ?? <>{main}{side}</>}</div>;
    return (
        <div className="grid grid-cols-12 gap-10 items-start">
            <div className="col-span-8 space-y-10 min-w-0">{main}</div>
            <div className="col-span-4 space-y-10 min-w-0">{side}</div>
        </div>
    );
}
