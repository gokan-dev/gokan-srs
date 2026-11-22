import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { kanjiRowMeanings, searchHeadword, searchSecondaryForm } from '@gokan/dataset-schema';
import type { SearchGroup } from '@gokan/dataset-schema';
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
import type { AppSearchResults } from '../utils/search.utils';

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
const groupLabelId = (group: SearchGroup) => `header-search-group-${group}`;

/** What can be searched: the field's placeholder and its name. */
const SEARCH_LABEL = 'Search words, kanji and grammar';

const GROUP_LABEL: Record<SearchGroup, string> = { words: 'Words', kanji: 'Kanji', grammar: 'Grammar' };

/** One row of the results: where it leads, and what it shows. */
interface SearchOption {
    key: string;
    path: string;
    main: ReactNode;
    support: string;
    /** Its study status, in the row's trailing slot. */
    status: ReactNode;
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

/** The results as rows, by group, in the order the matcher gives the groups. */
function groupedOptions(results: AppSearchResults): { group: SearchGroup; options: SearchOption[] }[] {
    const byGroup: Record<SearchGroup, SearchOption[]> = {
        words: results.words.map(({ row }) => ({
            key: `word-${row.id}`,
            path: vocabPath(row.id),
            main: (
                <>
                    <span className="font-mincho text-primary text-lg">{searchHeadword(row)}</span>
                    {/* A word shown in kana names its kanji spelling where the reading would go. */}
                    <span className={`${row.u ? 'font-mincho' : 'font-gothic'} text-secondary text-sm`}>{searchSecondaryForm(row)}</span>
                </>
            ),
            support: row.m,
            status: <WordStudyStatus vocabId={row.id} />,
        })),
        kanji: results.kanji.map(row => ({
            key: `kanji-${row[0]}`,
            path: kanjiPath(row[0]),
            main: <span className="font-mincho text-primary text-lg">{row[0]}</span>,
            support: kanjiRowMeanings(row).join(', '),
            status: <KanjiStudyStatus character={row[0]} />,
        })),
        grammar: results.grammar.map(row => ({
            key: `grammar-${row[0]}`,
            path: grammarPath(row[0]),
            main: (
                <>
                    {/* A title is the pattern itself: it keeps its width and the romaji beside it truncates first; it wraps only when it is wider than the whole row. */}
                    <span className="font-mincho text-primary text-lg shrink-0 max-w-full break-words">{row[1]}</span>
                    {row[2] && <span className="type-meta min-w-0 truncate">{row[2]}</span>}
                </>
            ),
            support: row[3],
            status: <GrammarStudyStatus grammarId={row[0]} />,
        })),
    };
    return results.groups.map(group => ({ group, options: byGroup[group] })).filter(({ options }) => options.length > 0);
}

export const SearchBar: React.FC<SearchBarProps> = ({ collapsed, className = '' }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
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
    const groups = query.trim() && search.data ? groupedOptions(search.data) : [];
    // Every row in display order, for the arrow keys and Enter.
    const options = groups.flatMap(({ options: rows }) => rows);
    const isSearching = search.status === 'loading' && search.data === undefined;

    /**
     * A new result set opens at its top, as typing opens it with no highlight: the panel keeps the
     * previous results while the next search runs, and kept their scroll with them, so the
     * first-ranked row could sit above the fold.
     */
    useLayoutEffect(() => {
        if (search.data === undefined || !panelRef.current) return;
        panelRef.current.scrollTop = 0;
    }, [search.data]);

    const close = () => {
        setIsOpen(false);
        setExpanded(false);
        setHighlighted(-1);
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setExpanded(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

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
            const next = e.key === 'ArrowDown' ? (highlighted + 1) % options.length : (highlighted <= 0 ? options.length - 1 : highlighted - 1);
            setHighlighted(next);
            // Focus stays in the field, so the panel does not follow the highlight by itself; the
            // option's scroll margin keeps it clear of its group's sticky label.
            document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
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
                    setQuery(e.target.value);
                    setIsOpen(true);
                    setHighlighted(-1);
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
                    onClick={() => setQuery('')}
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
            style={isFullScreen ? { top: panel.top, height: panel.height } : undefined}
            className={
                isFullScreen
                    ? 'fixed left-0 right-0 z-50 bg-surface border-t border-divider overflow-y-auto'
                    : 'absolute top-full right-0 mt-2 w-full min-w-80 md:min-w-[28rem] bg-surface border border-divider rounded-md shadow-lg z-50 max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto'
            }
        >
            {isSearching ? (
                <div className="p-4 text-center type-support">Searching...</div>
            ) : options.length > 0 ? (
                <div id={LISTBOX_ID} role="listbox" aria-label="Search results" className="flex flex-col">
                    {groups.map(({ group, options: rows }) => (
                        <div key={group} role="group" aria-labelledby={groupLabelId(group)} className="border-b border-divider last:border-0">
                            {/* Sticky, so a scrolled row keeps its group's name in view and the next group's label shows it follows; its edge is where a scrolled row passes under it. */}
                            <div id={groupLabelId(group)} role="presentation" className="type-label sticky top-0 z-10 bg-surface border-b border-divider px-3 pt-3 pb-1">{GROUP_LABEL[group]}</div>
                            {rows.map(option => {
                                const index = options.indexOf(option);
                                return (
                                    <div
                                        key={option.key}
                                        id={optionId(index)}
                                        role="option"
                                        aria-selected={index === highlighted}
                                        onClick={() => handleSelect(option.path)}
                                        onMouseEnter={() => setHighlighted(index)}
                                        className={`flex items-center gap-3 p-3 scroll-mt-10 border-b border-divider/50 last:border-0 cursor-pointer transition-colors ${index === highlighted ? 'bg-surface-hover' : ''}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 min-w-0">{option.main}</div>
                                            <div className="type-support truncate">{option.support}</div>
                                        </div>
                                        <div className="shrink-0" onClick={e => e.stopPropagation()}>
                                            {option.status}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center type-support">No results found</div>
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
