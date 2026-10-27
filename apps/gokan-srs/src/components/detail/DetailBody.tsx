import type { ReactNode } from "react";
import { useResponsive } from "../../context/Responsive/useResponsive";

type DetailBodyProps =
    | {
        /** The subject's content: meanings, sentences, words, explanations. */
        main: ReactNode;
        /** The learner's data and the dataset's: progress, related items, the details disclosure. */
        side: ReactNode;
        /** The one-column order below `lg`, when it interleaves the two (defaults to main, then side). */
        stacked?: ReactNode;
    }
    | {
        /**
         * One column at every width, in levels of importance (a word's page: the essentials, the
         * learner's study, Explore, the internals). A level that is null is left out.
         */
        levels: ReactNode[];
    };

/**
 * The body of a vocab, kanji or grammar page, under its DetailHeader. Either from `lg` the same
 * 12-column grid (8 for the content, 4 for the side, gap-10), so the side column starts where the
 * header's actions do, and below it one column in reading order; or one column of levels, a
 * `divider` line between two levels and nothing else (40px each side). Sections are spaced, not boxed.
 */
export function DetailBody(props: DetailBodyProps) {
    const { isMobile, isTablet } = useResponsive();
    if ('levels' in props) {
        const shown = props.levels.filter(level => level !== null && level !== undefined && level !== false);
        return (
            <div className="divide-y divide-divider">
                {shown.map((level, i) => <div key={i} className="py-10 first:pt-0 last:pb-0 space-y-10">{level}</div>)}
            </div>
        );
    }
    const { main, side, stacked } = props;
    if (isMobile || isTablet) return <div className="space-y-10">{stacked ?? <>{main}{side}</>}</div>;
    return (
        <div className="grid grid-cols-12 gap-10 items-start">
            <div className="col-span-8 space-y-10 min-w-0">{main}</div>
            <div className="col-span-4 space-y-10 min-w-0">{side}</div>
        </div>
    );
}
