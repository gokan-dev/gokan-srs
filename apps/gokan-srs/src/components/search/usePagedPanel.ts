import { useState } from "react";
import type { ExploreQuery } from "../../utils/exploreSearch.utils";
import { usePanelQuery } from "./usePanelQuery";

/** The one list of a panel that pages a single list (`group` left out). */
const ONE_LIST = '';

export interface PagedPanel {
    text: string;
    /** The field's text: typing starts every list on its first page again. */
    setText: (text: string) => void;
    query: ExploreQuery | null;
    /** How many show at first and per "Show N more". */
    pageSize: number;
    /** How many of a list show now (a panel with groups, as Related's Built from and Used in, names the group). */
    shown: (group?: string) => number;
    /** How many of `total` are still hidden. */
    more: (total: number, group?: string) => number;
    /** Shows the next page of a list, never past its `total`. */
    showMore: (total: number, group?: string) => void;
    /** Whether a list of `total` needs its search field: not when every item fits on its first page. */
    searchable: (total: number) => boolean;
}

/**
 * A searchable panel shown `pageSize` at a time (a word's Sentences and Related, a kanji's Words,
 * a grammar point's Examples): its search (`usePanelQuery`) and how far each of its lists is
 * shown. Drawn with `PanelSearch` (when `searchable`) and `ShowMore`.
 */
export function usePagedPanel(pageSize: number): PagedPanel {
    const { text, setText, query } = usePanelQuery();
    const [shownBy, setShownBy] = useState<Readonly<Record<string, number>>>({});
    const shown = (group = ONE_LIST) => shownBy[group] ?? pageSize;
    const more = (total: number, group = ONE_LIST) => Math.max(0, total - shown(group));
    return {
        text,
        setText: next => {
            setText(next);
            setShownBy({});
        },
        query,
        pageSize,
        shown,
        more,
        showMore: (total, group = ONE_LIST) => setShownBy(by => ({ ...by, [group]: Math.min(total, (by[group] ?? pageSize) + pageSize) })),
        searchable: total => total > pageSize,
    };
}
