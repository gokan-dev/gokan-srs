import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VocabularyService } from '../services/vocabulary.service';
import type { SearchIndex } from '../models/index.model';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useResponsive } from '../context/Responsive/useResponsive';

interface SearchBarProps {
    /**
     * Placement classes supplied by the header (width, flex order). The bar owns
     * no placement of its own, so the header stays the single place deciding
     * where it sits at each breakpoint.
     */
    className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ className = '' }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [panel, setPanel] = useState({ top: 0, height: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { isMobile } = useResponsive();

    const isPanelOpen = isOpen && query.trim().length > 0;

    /**
     * On a phone the results take the whole screen below the field. They used to
     * inherit the field's width, which was whatever was left between the logo and
     * five toolbar icons: too narrow to read a word, its reading and its gloss.
     */
    const isFullScreen = isMobile && isPanelOpen;

    // Searched once typing pauses; an empty field searches nothing.
    const searchTerm = useDebouncedValue(query.trim(), 300);
    const search = useAsyncData(searchTerm || null, () => VocabularyService.searchVocab(searchTerm), { keepPrevious: true });
    const results: SearchIndex = query.trim() ? search.data ?? [] : [];
    const isSearching = search.status === 'loading' && search.data === undefined;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    useEffect(() => {
        if (!isPanelOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isPanelOpen]);

    /**
     * The full-screen panel is `fixed`, so it needs the field's viewport position
     * rather than being able to sit at `top-full` like the desktop dropdown.
     * Measured rather than derived from a hardcoded header height, which changes
     * with the toolbar's padding and with where the bar wraps.
     *
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
        setIsOpen(false);
        setQuery('');
        void navigate(`/vocab/${id}`);
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <div ref={fieldRef} className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search vocabulary..."
                    /* text-base on mobile: under 16px, iOS Safari zooms the page in on focus. */
                    className="w-full bg-surface border border-divider rounded-full py-2 pl-10 pr-10 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-primary placeholder-tertiary transition-colors"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
                {query && (
                    <button
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {isPanelOpen && (
                <div
                    style={isFullScreen ? { top: panel.top, height: panel.height } : undefined}
                    className={
                        isFullScreen
                            ? 'fixed left-0 right-0 z-50 bg-surface border-t border-divider overflow-y-auto'
                            : 'absolute top-full mt-2 w-full bg-surface border border-divider rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto'
                    }
                >
                    {isSearching ? (
                        <div className="p-4 text-center text-sm text-tertiary">Searching...</div>
                    ) : results.length > 0 ? (
                        <div className="flex flex-col">
                            {results.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item.id)}
                                    className="flex flex-col items-start p-3 border-b border-divider/50 hover:bg-surface-hover transition-colors text-left last:border-0"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-mincho text-primary text-lg">{item.w}</span>
                                        <span className="font-gothic text-secondary text-sm">{item.r}</span>
                                    </div>
                                    <span className="font-serif text-tertiary text-xs truncate w-full mt-1">
                                        {item.m}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-sm text-tertiary">No results found</div>
                    )}
                </div>
            )}
        </div>
    );
};
