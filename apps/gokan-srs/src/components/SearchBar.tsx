import React, { useState, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isUsuallyKanaRow, kanjiRowMainReadings, kanjiRowMeanings } from '@gokan/dataset-schema';
import { SearchService } from '../services/search.service';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useResponsive } from '../context/Responsive/useResponsive';
import { useQuiz } from '../context/useQuiz';
import { WordStudyStatus } from './WordStudyStatus';
import { StatusDot } from './StatusDot';
import { KanjiKnownStatus } from './KanjiKnownStatus';
import { grammarPath, kanjiPath, vocabPath } from '../utils/navigation.utils';
import { grammarLearningStatus } from '../utils/learningStatus.utils';
import type { AppSearchHit, AppSearchResults } from '../utils/search.utils';
import { Chip } from './ui/Chip';

interface SearchBarProps {
    /**
     * Shown as an icon button that opens the field over the header, instead of
     * as a field. The header decides (phones, the narrow desktop range, session
     * focus mode), so it stays the single place deciding where search sits.
     */
    collapsed: boolean;
    className?: string;
}

const LISTBOX_ID = 'header-search-results';
const optionId = (index: number) => `header-search-result-${index}`;

/**
 * Rows rendered at first, and added each time the list is scrolled near its end: every match is
 * in the list (`a` finds thousands), but only what the reader scrolls to is drawn.
 */
export const SEARCH_PAGE_SIZE = 30;
/** How close to the list's end (px) a scroll draws the next page, so it is there before it is reached. */
const LOAD_MORE_MARGIN = 400;

/** What can be searched: the field's placeholder and its name. */
const SEARCH_LABEL = 'Search words, kanji and grammar';

/** The status column: wide enough for the widest status, "Not known yet", so every row's is one width. */
const STATUS_COLUMN = 'w-28 shrink-0 flex items-center';

/** The type badge each row carries, in the one list. */
const TYPE_LABEL: Record<AppSearchHit['group'], string> = { words: 'Word', kanji: 'Kanji', grammar: 'Grammar' };

/**
 * One row of the results: where it leads, and what it shows. Every type has one shape: line 1 the
 * thing itself (a word and its reading, a kanji and its main readings, a grammar title and its
 * romaji), line 2 its type chip, then its gloss, meanings or short explanation.
 */
interface SearchOption {
    key: string;
    type: AppSearchHit['group'];
    path: string;
    main: ReactNode;
    support: string;
    /** Its study status, in the row's trailing slot. */
    status: ReactNode;
    /**
     * The status is a control of its own (a word's Learn button), so a click on it does not also
     * open the row. Only then: a kanji's or a grammar point's status is plain text, part of the row.
     */
    interactiveStatus?: boolean;
}

/** A kanji's place in the learner's study, as on its page: Known or Not known yet. Nothing before setup. */
function KanjiStudyStatus({ character }: { character: string }) {
    const { state } = useQuiz();
    const knowledge = state.progress?.kanjiKnowledge;
    if (!knowledge) return null;
    return <KanjiKnownStatus known={knowledge.kanjiSet.has(character)} />;
}

/** A grammar point's learning status (New, Learning, Mastered). Nothing before setup. */
function GrammarStudyStatus({ grammarId }: { grammarId: string }) {
    const { state } = useQuiz();
    if (!state.progress) return null;
    return <StatusDot status={grammarLearningStatus(state.progress.grammarQueue.find(g => g.grammarId === grammarId))} />;
}

/** A hit as a row. */
function optionOf(hit: AppSearchHit): SearchOption {
    switch (hit.group) {
        case 'words': {
            // The build's row (searchWordRow): its headword (headwordOf) and secondary form (secondaryForm).
            const [id, headword, secondary, gloss] = hit.hit.row;
            return {
                key: `word-${id}`,
                type: 'words',
                path: vocabPath(id),
                main: (
                    <>
                        <span className="font-mincho text-primary text-lg">{headword}</span>
                        {/* A word shown in kana names its kanji spelling where the reading would go. */}
                        <span className={`${isUsuallyKanaRow(hit.hit.row) ? 'font-mincho' : 'font-gothic'} text-secondary text-sm min-w-0 truncate`}>{secondary}</span>
                    </>
                ),
                support: gloss,
                status: <WordStudyStatus vocabId={id} />,
                interactiveStatus: true,
            };
        }
        case 'kanji':
            return {
                key: `kanji-${hit.row[0]}`,
                type: 'kanji',
                path: kanjiPath(hit.row[0]),
                main: (
                    <>
                        <span className="font-mincho text-primary text-lg">{hit.row[0]}</span>
                        <span className="font-gothic text-secondary text-sm min-w-0 truncate">{kanjiRowMainReadings(hit.row).join('、')}</span>
                    </>
                ),
                support: kanjiRowMeanings(hit.row).join(', '),
                status: <KanjiStudyStatus character={hit.row[0]} />,
            };
        case 'grammar':
            return {
                key: `grammar-${hit.row[0]}`,
                type: 'grammar',
                path: grammarPath(hit.row[0]),
                main: (
                    <>
                        {/* A title is the pattern itself: it keeps its width and the romaji beside it truncates first; it wraps only when it is wider than the whole line. */}
                        <span className="font-mincho text-primary text-lg shrink-0 max-w-full break-words">{hit.row[1]}</span>
                        {hit.row[2] && <span className="type-meta min-w-0 truncate">{hit.row[2]}</span>}
                    </>
                ),
                support: hit.row[3],
                status: <GrammarStudyStatus grammarId={hit.row[0]} />,
            };
    }
}

export const SearchBar: React.FC<SearchBarProps> = ({ collapsed, className = '' }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    // How many of a result set's rows are drawn: a new result set starts at one page.
    const [paging, setPaging] = useState<{ results: AppSearchResults | undefined; count: number }>({ results: undefined, count: SEARCH_PAGE_SIZE });
    const [panel, setPanel] = useState({ top: 0, height: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { isMobile } = useResponsive();

    const isPanelOpen = isOpen && query.trim().length > 0;
    const showField = !collapsed || expanded;

    /**
     * On a phone the results take the whole screen below the field: a word, its
     * reading, its gloss and its Learn button do not fit a dropdown's width.
     */
    const isFullScreen = isMobile && isPanelOpen;

    // Searched once typing pauses; an empty field searches nothing.
    const searchTerm = useDebouncedValue(query.trim(), 300);
    const search = useAsyncData(searchTerm || null, () => SearchService.search(searchTerm), { keepPrevious: true });
    const hits = query.trim() && search.data ? search.data.hits : [];
    const visible = paging.results === search.data ? paging.count : SEARCH_PAGE_SIZE;
    const showMore = () => setPaging({ results: search.data, count: visible + SEARCH_PAGE_SIZE });
    // Every row drawn, in the one order across types, for the arrow keys and Enter.
    const options = hits.slice(0, visible).map(optionOf);
    const hasMore = hits.length > options.length;
    /**
     * Whether the results drawn answer what is typed: a search ran for it. Until then (typing not
     * yet paused, the index still downloading on the first search) an empty list means nothing
     * yet, so the panel says it is searching, never "No results found".
     */
    const settled = search.status === 'ready' && searchTerm === query.trim();
    const { state: quizState } = useQuiz();
    // Before setup no row has a status: the column is left out rather than held empty.
    const hasStatus = Boolean(quizState.progress);

    /**
     * A new result set opens at its top, as typing opens it with no highlight: the panel keeps the
     * previous results while the next search runs, and kept their scroll with them, so the
     * first-ranked row could sit above the fold.
     */
    useLayoutEffect(() => {
        if (search.data === undefined || !panelRef.current) return;
        panelRef.current.scrollTop = 0;
    }, [search.data]);

    /** Scrolled near the end of what is drawn, the next page is drawn. */
    const loadMoreNearEnd = (panelElement: HTMLDivElement) => {
        if (!hasMore) return;
        if (panelElement.scrollTop + panelElement.clientHeight >= panelElement.scrollHeight - LOAD_MORE_MARGIN) showMore();
    };

    /**
     * Focus stays in the field, so the panel does not follow the highlight by itself: a row the
     * arrow keys reach is scrolled into view once drawn (the next page, for one past the end).
     */
    const scrollTarget = useRef<number | null>(null);
    useLayoutEffect(() => {
        if (scrollTarget.current === null) return;
        document.getElementById(optionId(scrollTarget.current))?.scrollIntoView({ block: 'nearest' });
        scrollTarget.current = null;
    }, [highlighted, visible]);

    const changeQuery = (value: string) => {
        setQuery(value);
        setHighlighted(-1);
    };

    const close = () => {
        setIsOpen(false);
        setExpanded(false);
        setHighlighted(-1);
    };

    // A click outside closes the panel the same way, through the one reset.
    const onClickOutside = useEffectEvent((event: MouseEvent) => {
        if (wrapperRef.current && event.target instanceof Node && !wrapperRef.current.contains(event.target)) close();
    });
    useEffect(() => {
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    /**
     * The full-screen panel is `fixed`, so it needs the field's viewport position
     * rather than being able to sit at `top-full` like the desktop dropdown.
     * Height comes from `visualViewport` when available, so the panel ends above
     * the on-screen keyboard instead of running underneath it.
     */
    useLayoutEffect(() => {
        if (!isFullScreen) return;

        const measure = () => {
            const rect = fieldRef.current?.getBoundingClientRect();
            if (!rect) return;
            const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
            setPanel({ top: rect.bottom, height: Math.max(0, viewportHeight - rect.bottom) });
        };

        measure();
        window.addEventListener('resize', measure);
        window.visualViewport?.addEventListener('resize', measure);
        return () => {
            window.removeEventListener('resize', measure);
            window.visualViewport?.removeEventListener('resize', measure);
        };
    }, [isFullScreen]);

    /** Locking the page keeps the measured `top` valid: nothing can scroll out from under a fixed panel. */
    useEffect(() => {
        if (!isFullScreen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isFullScreen]);

    const handleSelect = (path: string) => {
        close();
        setQuery('');
        void navigate(path);
    };

    // The combobox pattern: focus stays in the field, arrows move a highlighted option.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            close();
            return;
        }
        if (!isPanelOpen || options.length === 0) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            let next: number;
            if (e.key === 'ArrowDown') {
                // Past the last drawn row: the next page, when there is one; otherwise back to the top.
                next = highlighted + 1 < options.length ? highlighted + 1 : hasMore ? options.length : 0;
                if (next >= options.length) showMore();
            } else {
                next = highlighted <= 0 ? options.length - 1 : highlighted - 1;
            }
            scrollTarget.current = next;
            setHighlighted(next);
        } else if (e.key === 'Enter') {
            const target = options[highlighted] ?? options[0];
            handleSelect(target.path);
        }
    };

    const field = (
        <div ref={fieldRef} className="relative flex-1">
            <input
                type="text"
                role="combobox"
                aria-expanded={isPanelOpen}
                aria-controls={LISTBOX_ID}
                aria-autocomplete="list"
                aria-activedescendant={isPanelOpen && highlighted >= 0 ? optionId(highlighted) : undefined}
                aria-label={SEARCH_LABEL}
                value={query}
                autoFocus={collapsed}
                onChange={(e) => {
                    changeQuery(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={SEARCH_LABEL}
                /* text-base on mobile: under 16px, iOS Safari zooms the page in on focus. */
                className="w-full bg-surface border border-divider rounded-md py-2 pl-9 pr-9 text-base md:text-sm focus:outline-none focus:border-accent text-primary placeholder:text-input-placeholder transition-colors"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" aria-hidden="true" />
            {query && (
                <button
                    type="button"
                    onClick={() => changeQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary transition-colors cursor-pointer"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );

    const resultsPanel = isPanelOpen && (
        <div
            ref={panelRef}
            onScroll={e => loadMoreNearEnd(e.currentTarget)}
            style={isFullScreen ? { top: panel.top, height: panel.height } : undefined}
            className={
                isFullScreen
                    ? 'fixed left-0 right-0 z-50 bg-surface border-t border-divider overflow-y-auto'
                    : 'absolute top-full right-0 mt-2 w-full min-w-80 md:min-w-[28rem] bg-surface border border-divider rounded-md shadow-lg z-50 max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto'
            }
        >
            {options.length > 0 ? (
                <div id={LISTBOX_ID} role="listbox" aria-label="Search results" className="flex flex-col">
                    {options.map((option, index) => (
                        <div
                            key={option.key}
                            id={optionId(index)}
                            role="option"
                            data-hit={option.type}
                            aria-selected={index === highlighted}
                            onClick={() => handleSelect(option.path)}
                            onMouseEnter={() => setHighlighted(index)}
                            aria-setsize={hits.length}
                            aria-posinset={index + 1}
                            className={`flex items-center gap-3 p-3 border-b border-divider/50 last:border-0 cursor-pointer transition-colors ${index === highlighted ? 'bg-surface-hover' : ''}`}
                        >
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div data-row-line="1" className="flex items-baseline gap-2 min-w-0">{option.main}</div>
                                <div data-row-line="2" className="flex items-baseline gap-2 min-w-0">
                                    {/* Its type leads the line, as metadata: every row's chip sits in one column, whatever its status. */}
                                    <span data-type-chip className="shrink-0 inline-flex"><Chip size="sm">{TYPE_LABEL[option.type]}</Chip></span>
                                    <span className="type-support min-w-0 truncate">{option.support}</span>
                                </div>
                            </div>
                            {/* One width for every row's status, centred on the row: Learn and each status line up down the list. */}
                            {hasStatus && (option.interactiveStatus
                                ? <div data-row-status className={STATUS_COLUMN} onClick={e => e.stopPropagation()}>{option.status}</div>
                                : <div data-row-status className={STATUS_COLUMN}>{option.status}</div>)}
                        </div>
                    ))}
                </div>
            ) : settled ? (
                <div className="p-4 text-center type-support">No results found</div>
            ) : search.status === 'error' ? (
                <div className="p-4 text-center type-support">Search could not load. Try again in a moment.</div>
            ) : (
                <div className="p-4 text-center type-support" role="status">Searching…</div>
            )}
        </div>
    );

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {!showField && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    aria-label={SEARCH_LABEL}
                    className="flex items-center justify-center w-10 h-10 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                    <Search size={18} />
                </button>
            )}
            {showField && !collapsed && (
                <>
                    {field}
                    {resultsPanel}
                </>
            )}
            {showField && collapsed && (
                // Opened from the icon: the field takes the whole header row until closed.
                <div className="fixed inset-x-0 top-0 z-50 bg-background border-b border-divider">
                    <div className="relative max-w-5xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center gap-2">
                        {field}
                        <button
                            type="button"
                            onClick={close}
                            className="shrink-0 px-2 h-10 font-sans text-sm text-accent hover:text-accent-hover cursor-pointer"
                        >
                            Close
                        </button>
                        {resultsPanel}
                    </div>
                </div>
            )}
        </div>
    );
};
