import type { ReactNode } from "react";
import { PAGE_BLEED_INSET } from "../Page";
import { TabNav, type PageTab } from "../ui/TabNav";
import { DetailBody } from "./DetailBody";
import { DetailSection } from "./DetailSection";
import type { DetailTabs } from "./useDetailTabs";

interface DetailTabsBodyProps<T extends string> {
    tabs: DetailTabs<T>;
    /** The row's accessible name: "About this word". */
    label: string;
    /** Each tab's label, which is also its section's heading on the full page. */
    labels: Record<T, string>;
    /** A tab's panel; `preview` on the full page, where a long one shows a shorter first page. */
    render: (tab: T, preview: boolean) => ReactNode;
    /** The full page's columns, each in order: the first of `main` is the essentials. */
    main: readonly T[];
    side: readonly T[];
    /** The tabs whose panel draws its own headings (the essentials, a Study tab): no section heading on the full page. */
    ownHeadings: readonly T[];
    /** On the full page only, at the foot of the side column (a kanji's Details, folded into its first tab below `lg`). */
    sideFoot?: ReactNode;
}

/**
 * A tabbed detail page's body (`useDetailTabs`): below `lg` the sticky row of tabs (`TabNav`
 * page tabs) and every tab's panel, only the open one with content; from `lg` the same panels as
 * one full page on the 8/4 grid, each a section (DESIGN_SYSTEM section 5, Tabs on phones, one full
 * page on desktop): the essentials, then under a `divider` line the rest of the main column.
 */
export function DetailTabsBody<T extends string>({ tabs, label, labels, render, main, side, ownHeadings, sideFoot }: DetailTabsBodyProps<T>) {
    const { available, open, choose, rowRef, panelRef, tabId, panelId, sectionId } = tabs;
    const has = (tab: T) => available.includes(tab);

    // Every tab's panel is there for its tab's aria-controls; only the open one has content.
    const panels = available.map(tab => (
        <div
            key={tab}
            ref={tab === open ? panelRef : undefined}
            id={panelId(tab)}
            role="tabpanel"
            aria-labelledby={tabId(tab)}
            hidden={tab !== open}
            className="pt-6"
        >
            {tab === open && render(tab, false)}
        </div>
    ));

    const section = (tab: T) => ownHeadings.includes(tab)
        ? <div key={tab} id={sectionId(tab)} className="scroll-mt-6">{render(tab, true)}</div>
        : <DetailSection key={tab} id={sectionId(tab)} title={labels[tab]} focusable>{render(tab, true)}</DetailSection>;
    const [essentials, ...rest] = main.filter(has);
    const full = {
        // A line sets the rest of the subject's content apart from its essentials.
        main: (
            <>
                {section(essentials)}
                {rest.length > 0 && <div className="border-t border-divider pt-10 space-y-10">{rest.map(section)}</div>}
            </>
        ),
        side: <>{side.filter(has).map(section)}{sideFoot}</>,
    };

    const row: PageTab<T>[] = available.map(tab => ({ key: tab, label: labels[tab], id: tabId(tab), controls: panelId(tab) }));
    return (
        <DetailBody
            full={full}
            tabsRef={rowRef}
            tabs={<TabNav label={label} tabs={row} selected={open} onSelect={choose} className={PAGE_BLEED_INSET} />}
            panels={panels}
        />
    );
}
