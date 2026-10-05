import type { ReactNode } from "react";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { JlptCoverageBars, type JlptLevelRow } from "./JlptCoverageBars";

interface CoverageChartProps<D> {
    /** Identifies the index being loaded (see useAsyncData). */
    loadKey: string;
    /** The index the rows are counted against; null when it is unavailable. */
    load: () => Promise<D | null>;
    rowsOf: (data: D) => JlptLevelRow[];
    unavailableText: string;
    itemLabel: string;
    headline: string;
    keyColumnLabel?: string;
    /** Shown under the bars, e.g. a link to the full list. */
    children?: ReactNode;
}

/**
 * A coverage chart on the Stats screen: loads its index, then draws the shared
 * three-way bars. The vocab JLPT, grammar JLPT and chapter charts differ only in what
 * they load and how they count, which is all they supply.
 */
export function CoverageChart<D>({ loadKey, load, rowsOf, unavailableText, itemLabel, headline, keyColumnLabel, children }: CoverageChartProps<D>) {
    const index = useAsyncData(loadKey, load);

    if (index.status === 'error' || (index.status === 'ready' && index.data === null)) {
        return <p className="text-sm text-tertiary">{unavailableText}</p>;
    }
    if (!index.data) {
        return <div className="h-40 animate-pulse rounded bg-surface-hover/40" />;
    }

    return (
        <div className="flex flex-col gap-2">
            <JlptCoverageBars rows={rowsOf(index.data)} itemLabel={itemLabel} headline={headline} keyColumnLabel={keyColumnLabel} />
            {children}
        </div>
    );
}
