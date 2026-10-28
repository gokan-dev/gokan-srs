import { useMemo, useState } from "react";
import { readExploreQuery, type ExploreQuery } from "../../../utils/exploreSearch.utils";

/** A panel's search: the field's text, and the query read from it once. */
export function usePanelQuery(): { text: string; setText: (text: string) => void; query: ExploreQuery | null } {
    const [text, setText] = useState('');
    const query = useMemo(() => readExploreQuery(text), [text]);
    return { text, setText, query };
}
