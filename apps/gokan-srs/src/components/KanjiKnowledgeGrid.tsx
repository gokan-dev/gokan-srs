import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { kanjiOrder } from "@gokan/dataset-schema";
import { useKanjiForm } from "../context/KanjiForm/useKanjiForm";
import type { KanjiLearningMethod } from "../models/user.model";
import { findKanjiMatch } from "../utils/kanjiSearch.utils";
import { useResponsive } from "../context/Responsive/useResponsive";

/**
 * Ten per row is the desktop layout. On a phone it left each tile around 20px
 * wide once the two gutters and nine gaps were taken out, so a 24px glyph
 * overflowed its own tile and nothing was big enough to tap accurately. Five
 * keeps the tiles legible and thumb-sized; the gutter still reads in fives,
 * which is no harder to scan than tens.
 */
const ROW_SIZE = 10;
const MOBILE_ROW_SIZE = 5;

/** Width of the position gutter, mirrored as an empty spacer on the right. */
const GUTTER_WIDTH = '2.5rem';
const MOBILE_GUTTER_WIDTH = '1.75rem';

interface KanjiKnowledgeGridProps {
    allKanji: string[];
    method: KanjiLearningMethod;
    /** Controls shown with the search in the sticky toolbar (the count stepper). */
    toolbar?: ReactNode;
}

/**
 * Every kanji in learning order, in the page flow (no inner scroll pane), with a
 * toolbar that stays at the top while the grid scrolls by. Click a tile to mark
 * it known or not known.
 */
export function KanjiKnowledgeGrid({ allKanji, method, toolbar }: KanjiKnowledgeGridProps) {
    const { state, toggleKanji } = useKanjiForm();
    const { isMobile } = useResponsive();
    const [query, setQuery] = useState('');
    const gridRef = useRef<HTMLDivElement>(null);

    const rowSize = isMobile ? MOBILE_ROW_SIZE : ROW_SIZE;
    const gutterWidth = isMobile ? MOBILE_GUTTER_WIDTH : GUTTER_WIDTH;

    const match = useMemo(() => findKanjiMatch(allKanji, query), [allKanji, query]);
    const hasQuery = query.trim() !== '';

    const rows = useMemo(() => {
        const chunks: string[][] = [];
        for (let i = 0; i < allKanji.length; i += rowSize) {
            chunks.push(allKanji.slice(i, i + rowSize));
        }
        return chunks;
    }, [allKanji, rowSize]);

    // Centre one position on screen: the grid is in the page flow, so the page scrolls.
    const scrollToPosition = useCallback((position: number) => {
        gridRef.current
            ?.querySelector<HTMLElement>(`[data-kanji-pos="${position}"]`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (match) scrollToPosition(match.index);
    }, [match, scrollToPosition]);

    // Follow the count as it changes: the frontier (the last kanji the count
    // covers) is exactly what the user is looking at when they nudge the number,
    // and it is otherwise hundreds of rows away from wherever the pane happens to
    // be sitting. The ref skips the first run, so opening the page doesn't
    // animate the list somewhere the user didn't ask to go.
    const lastCountRef = useRef<number | null>(null);
    useEffect(() => {
        const previous = lastCountRef.current;
        lastCountRef.current = state.kanjiCount;
        if (previous === null || previous === state.kanjiCount) return;

        scrollToPosition(Math.max(0, state.kanjiCount - 1));
    }, [state.kanjiCount, scrollToPosition]);

    // The known set reaches across orders; the legend counts only this list's share of it.
    const knownInList = useMemo(() => allKanji.filter(kanji => state.knownKanji.has(kanji)).length, [allKanji, state.knownKanji]);
    const matchIsKnown = match ? state.knownKanji.has(match.kanji) : false;

    return (
        <div className="w-full">
            <div className="sticky top-0 z-10 bg-background py-3 space-y-3 border-b border-divider">
            {toolbar}
            <div className="relative">
                <Search
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Find a kanji or a position (語 or 1240)"
                    aria-label="Find a kanji or a position"
                    className="w-full h-10 pl-9 pr-9 border rounded-md border-divider bg-surface text-primary font-gothic text-base md:text-sm placeholder:text-input-placeholder"
                />
                {hasQuery && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-tertiary hover:text-primary cursor-pointer"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            </div>

            {hasQuery && (
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm font-gothic">
                    {match ? (
                        <>
                            <span className="font-mincho text-xl text-primary">{match.kanji}</span>
                            <span className="text-tertiary tabular-nums">#{match.index + 1}</span>
                            <span className={matchIsKnown ? "text-accent" : "text-tertiary"}>
                                {matchIsKnown ? 'Known' : 'Not known yet'}
                            </span>
                            <button
                                type="button"
                                onClick={() => toggleKanji(match.kanji)}
                                className="text-xs px-2 py-1 rounded-md border border-divider bg-surface text-secondary hover:bg-surface-hover hover:text-primary cursor-pointer"
                            >
                                {matchIsKnown ? 'Mark as not known' : 'Mark as known'}
                            </button>
                        </>
                    ) : (
                        <span className="text-tertiary">Not in this list</span>
                    )}
                </div>
            )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 mb-3">
                <p className="type-support flex-1 min-w-48">Click a kanji to mark it known or not known. Your marks stay when you change order.</p>
                <span className="inline-flex items-center gap-1.5 type-meta">
                    <span className="w-4 h-4 rounded-sm border border-divider bg-surface" aria-hidden="true" /> Known
                </span>
                <span className="inline-flex items-center gap-1.5 type-meta">
                    <span className="w-4 h-4 rounded-sm border border-dashed border-divider" aria-hidden="true" /> Not known
                </span>
                <span className="type-meta tabular-nums">{knownInList.toLocaleString('en-US')} of {allKanji.length.toLocaleString('en-US')} in {kanjiOrder(method).label} order known</span>
            </div>

            <div ref={gridRef} className="w-full">
                <div className="flex flex-col gap-1.5">
                    {rows.map((row, rowIndex) => (
                        <div
                            key={rowIndex}
                            className="grid items-center gap-1.5"
                            /* Full pane width, matching the search box above it: the
                               tiles take whatever is left after the position gutter,
                               and stay square via aspect-square below. The trailing
                               column is an empty spacer mirroring that gutter (grid
                               auto-placement never fills it), so the tiles sit centred
                               on the page rather than pushed right by the numbers. */
                            style={{ gridTemplateColumns: `${gutterWidth} repeat(${rowSize}, minmax(0, 1fr)) ${gutterWidth}` }}
                        >
                            {/*
                                Position gutter: makes "the kanji around 1240" findable by eye,
                                without going through the search box.
                            */}
                            <div className="type-meta tabular-nums text-right pr-1 select-none">
                                {rowIndex * rowSize + 1}
                            </div>

                            {row.map((kanji, columnIndex) => {
                                const position = rowIndex * rowSize + columnIndex;
                                const isKnown = state.knownKanji.has(kanji);
                                const isMatch = match?.index === position;

                                return (
                                    <button
                                        key={`${kanji}-${position}`}
                                        type="button"
                                        data-kanji-pos={position}
                                        onClick={() => toggleKanji(kanji)}
                                        title={`#${position + 1} ${kanji} - ${isKnown ? 'known' : 'not known yet'}`}
                                        aria-pressed={isKnown}
                                        className={`
                                            w-full aspect-square max-h-16 rounded-md border font-mincho text-2xl leading-none transition-colors cursor-pointer
                                            flex items-center justify-center
                                            ${isKnown
                                                ? "text-primary bg-surface border-divider hover:border-accent"
                                                : "text-tertiary bg-transparent border-dashed border-divider hover:border-accent hover:text-secondary"
                                            }
                                            ${isMatch ? "ring-2 ring-accent" : ""}
                                        `.trim().replace(/\s+/g, ' ')}
                                    >
                                        {kanji}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
