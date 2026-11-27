import type { ReactNode } from "react";
import { splitAtRanges } from "../../utils/exploreSearch.utils";

/**
 * Text with a search's matches marked: a tint behind them, the text keeping its own colour.
 * `render` draws each part's text (a nuance line's through MixedText, so its Japanese keeps its
 * face and stays on one line with marks on); plain text by default.
 */
export function Marked({ text, ranges, render = part => part }: { text: string; ranges: readonly [number, number][]; render?: (text: string) => ReactNode }) {
    if (ranges.length === 0) return <>{render(text)}</>;
    return (
        <>
            {splitAtRanges(text, ranges).map((part, i) => (part.match
                ? <mark key={i} className="bg-accent/15 text-inherit rounded-sm">{render(part.text)}</mark>
                : <span key={i}>{render(part.text)}</span>))}
        </>
    );
}
