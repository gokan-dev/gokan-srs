import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VocabularyService } from '../services/vocabulary.service';
import { searchHeadword, searchSecondaryForm } from '@gokan/dataset-schema';
import type { SearchIndex } from '@gokan/dataset-schema';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useResponsive } from '../context/Responsive/useResponsive';
import { WordStudyStatus } from './WordStudyStatus';

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

export const SearchBar: React.FC<SearchBarProps> = ({ collapsed, className = '' }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const [panel, setPanel] = useState({ top: 0, height: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
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
    const search = useAsyncData(searchTerm || null, () => VocabularyService.searchVocab(searchTerm), { keepPrevious: true });
    const results: SearchIndex = query.trim() ? search.data ?? [] : [];
    const isSearching = search.status === 'loading' && search.data === undefined;

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

    const handleSelect = (id: string) => {
        close();
        setQuery('');
        void navigate(`/vocab/${id}`);
    };

    // The combobox pattern: focus stays in the field, arrows move a highlighted option.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            close();
            return;
        }
        if (!isPanelOpen || results.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted(h => (h + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted(h => (h <= 0 ? results.length - 1 : h - 1));
        } else if (e.key === 'Enter') {
            const target = results[highlighted] ?? results[0];
            handleSelect(target.id);
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
                aria-label="Search words"
                value={query}
                autoFocus={collapsed}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    setHighlighted(-1);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search words: kanji, kana, romaji or English"
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
            style={isFullScreen ? { top: panel.top, height: panel.height } : undefined}
            className={
                isFullScreen
                    ? 'fixed left-0 right-0 z-50 bg-surface border-t border-divider overflow-y-auto'
                    : 'absolute top-full right-0 mt-2 w-full min-w-80 bg-surface border border-divider rounded-md shadow-lg z-50 max-h-96 overflow-y-auto'
            }
        >
            {isSearching ? (
                <div className="p-4 text-center type-support">Searching...</div>
            ) : results.length > 0 ? (
                <div id={LISTBOX_ID} role="listbox" aria-label="Words" className="flex flex-col">
                    {results.map((item, index) => (
                        <div
                            key={item.id}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === highlighted}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setHighlighted(index)}
                            className={`flex items-center gap-3 p-3 border-b border-divider/50 last:border-0 cursor-pointer transition-colors ${index === highlighted ? 'bg-surface-hover' : ''}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-mincho text-primary text-lg">{searchHeadword(item)}</span>
                                    {/* A word shown in kana names its kanji spelling where the reading would go. */}
                                    <span className={`${item.u ? 'font-mincho' : 'font-gothic'} text-secondary text-sm`}>{searchSecondaryForm(item)}</span>
                                </div>
                                <div className="type-support truncate">{item.m}</div>
                            </div>
                            <div className="shrink-0" onClick={e => e.stopPropagation()}>
                                <WordStudyStatus vocabId={item.id} />
                            </div>
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
                    aria-label="Search words"
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
