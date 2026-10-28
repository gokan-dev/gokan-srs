import { splitAtRanges } from "../../utils/exploreSearch.utils";

/** Text with a search's matches marked: a tint behind them, the text keeping its own colour. */
export function Marked({ text, ranges }: { text: string; ranges: readonly [number, number][] }) {
    if (ranges.length === 0) return <>{text}</>;
    return (
        <>
            {splitAtRanges(text, ranges).map((part, i) => (part.match
                ? <mark key={i} className="bg-accent/15 text-inherit rounded-sm">{part.text}</mark>
                : <span key={i}>{part.text}</span>))}
        </>
    );
}
