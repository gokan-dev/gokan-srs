import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
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

/**
 * The grid is labelled by the order it is laid out in, not by a hardcoded
 * "KKLC" - more orders (RTK, JLPT) are expected, and only this label plus the
 * loaded list changes when one arrives.
 */
const ORDER_LABELS: Record<KanjiLearningMethod, string> = {
    kklc: 'KKLC order',
    rtk: 'RTK order',
    jlpt: 'JLPT order',
    custom: 'custom order',
};

interface KanjiKnowledgeGridProps {
    allKanji: string[];
    method: KanjiLearningMethod;
    /**
     * Starting height of the scroll pane (any CSS length). The pane is
     * user-resizable from there; the profile page - where browsing the list is
     * half of why you are on the page - opens taller than the setup wizard,
     * which only needs enough of it to confirm the count landed where expected.
     */
    initialHeight?: string;
}

export function KanjiKnowledgeGrid({ allKanji, method, initialHeight = '22rem' }: KanjiKnowledgeGridProps) {
    const { state, toggleKanji } = useKanjiForm();
    const { isMobile } = useResponsive();
    const [query, setQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

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

    // Centre one position in the pane, and in the pane only: scrollIntoView would
    // also scroll the page itself, yanking the whole profile view while the user
    // is still typing in the search box or holding down a stepper button.
    const scrollToPosition = useCallback((position: number) => {
        const container = scrollRef.current;
        if (!container) return;

        const target = container.querySelector<HTMLElement>(`[data-kanji-pos="${position}"]`);
        if (!target) return;

        container.scrollTo({
            top: Math.max(0, target.offsetTop - container.clientHeight / 2 + target.offsetHeight / 2),
            behavior: 'smooth',
        });
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

    const knownCount = state.knownKanji.size;
    const matchIsKnown = match ? state.knownKanji.has(match.kanji) : false;

    return (
        <div className="w-full mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="type-label">
                    Known kanji ({ORDER_LABELS[method]})
                </div>
                <div className="text-xs text-tertiary font-gothic tabular-nums">
                    {knownCount} known of {allKanji.length}
                </div>
            </div>

            <div className="relative mb-3">
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
                    className="w-full h-10 pl-9 pr-9 border rounded-md border-divider bg-surface text-primary font-gothic text-sm placeholder:text-input-placeholder"
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
                                {matchIsKnown ? 'Mark as unknown' : 'Mark as known'}
                            </button>
                        </>
                    ) : (
                        <span className="text-tertiary">Not in this list</span>
                    )}
                </div>
            )}

            {/*
                `resize: vertical` gives the pane a native drag handle, like a
                textarea - how tall the list should be depends on the screen and
                on what the user is doing, so it is theirs to set. That needs a
                real height rather than a max-height, and the fade is top-only:
                a bottom fade would wash out the handle sitting in that corner.
            */}
            <div
                ref={scrollRef}
                className="relative w-full overflow-y-auto resize-y py-3 scrollbar-subtle"
                style={{
                    height: initialHeight,
                    minHeight: '10rem',
                    maskImage: 'linear-gradient(to bottom, transparent, black 24px)',
                }}
            >
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
                            <div className="text-xs text-tertiary/70 font-gothic tabular-nums text-right pr-1 select-none">
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
                                            w-full aspect-square max-h-16 rounded-md font-mincho text-2xl leading-none transition-colors cursor-pointer
                                            flex items-center justify-center
                                            ${isKnown
                                                ? "text-primary bg-feedback-background ring-1 ring-accent/25 hover:bg-surface-hover"
                                                : "text-tertiary/70 bg-transparent hover:bg-surface-hover hover:text-secondary"
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

            <div className="mt-3 text-xs text-secondary font-serif">
                Known kanji are softly highlighted. Click any one to mark it known or unknown.
            </div>
        </div>
    );
}
