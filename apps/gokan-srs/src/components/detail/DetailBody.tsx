import type { ReactNode, Ref } from "react";
import { useFullDetailPage } from "./useFullDetailPage";
import { PAGE_BLEED } from "../Page";

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
         * One column at every width under a row of tabs (a word's page): the row, which sticks to
         * the viewport's top once the header has scrolled away, then the tab panels. The row spans
         * the page's padding (its background covers the content scrolling under it), so the tabs
         * put the padding back themselves (`PAGE_BLEED_INSET`), scrolling under the screen's edge.
         */
        tabs: ReactNode;
        panels: ReactNode;
        /** The sticky row's frame, to tell whether it is stuck. */
        tabsRef?: Ref<HTMLDivElement>;
        /**
         * The same panels as one full page from `lg` (`useFullDetailPage`): no tab row, the panels
         * stacked as sections on the 8/4 grid, under a `divider` line. Below `lg`, the tabs.
         */
        full?: { main: ReactNode; side: ReactNode };
    };

/**
 * The body of a vocab, kanji or grammar page, under its DetailHeader. Either from `lg` the same
 * 12-column grid (8 for the content, 4 for the side, gap-10), so the side column starts where the
 * header's actions do, and below it one column in reading order; or one column of tabs, the row
 * on the page background (the app header does not stick, so the row sticks at the top) and one
 * panel under it, which from `lg` may be one full page instead (`full`: the same panels as
 * sections, on the grid). Sections are spaced, not boxed.
 */
export function DetailBody(props: DetailBodyProps) {
    const fullPage = useFullDetailPage();
    if ('tabs' in props) {
        const { tabs, panels, tabsRef, full } = props;
        if (full && fullPage) return <div className="border-t border-divider pt-8"><Grid main={full.main} side={full.side} /></div>;
        return (
            <>
                <div ref={tabsRef} data-detail-tabs className={`sticky top-0 z-20 ${PAGE_BLEED} bg-background`}>{tabs}</div>
                {panels}
            </>
        );
    }
    const { main, side, stacked } = props;
    if (!fullPage) return <div className="space-y-10">{stacked ?? <>{main}{side}</>}</div>;
    return <Grid main={main} side={side} />;
}

function Grid({ main, side }: { main: ReactNode; side: ReactNode }) {
    return (
        <div className="grid grid-cols-12 gap-10 items-start">
            <div className="col-span-8 space-y-10 min-w-0">{main}</div>
            <div className="col-span-4 space-y-10 min-w-0">{side}</div>
        </div>
    );
}
