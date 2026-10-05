import { useState, useEffect, useMemo, useRef } from "react";
import { usePersistControls, usePersistedControlsSnapshot } from "../../../hooks/usePersistedControls";
import type { GrammarProgress, GrammarPoint } from "../../../models/grammar.model";
import { GrammarService } from "../../../services/grammar.service";
import { GrammarCard } from "../../../components/GrammarCard";
import { CardSkeleton } from "../../../components/CardSkeleton";
import { Search, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { isGrammarFullyMastered } from "../../../services/grammarScheduling";
import { useAsyncData } from "../../../hooks/useAsyncData";

interface SmartGrammarListProps {
    progress: GrammarProgress[];
    onGrammarClick?: (grammarId: string) => void;
}

type SortField = 'added_date' | 'srs_stage' | 'next_review' | 'failures' | 'jlpt_level' | 'mastery';
type SortDirection = 'asc' | 'desc';

// The list controls persist across navigation (e.g. into a grammar detail page
// and back) so the user returns to the same sort/filter/page they left -
// mirrors SmartVocabList, under a separate sessionStorage key.
const LIST_STATE_KEY = 'gokan_stats_grammarlist_state';

interface PersistedListState {
    searchQuery: string;
    sortField: SortField;
    sortDir: SortDirection;
    page: number;
    showMastered: boolean;
}


/** Grammar's equivalent of SmartVocabList - simplified since a GrammarProgress has one SRSEntry (no reading/meaning split) and grammar has no frequency data (JLPT level stands in for that sort). */
export function SmartGrammarList({ progress, onGrammarClick }: SmartGrammarListProps) {
    // Every point's file is loaded up front so search filters instantly; the service
    // caches them, so a later change to the list only fetches what is new.
    const grammarIds = useMemo(() => progress.map(g => g.grammarId), [progress]);
    const loadedPoints = useAsyncData(grammarIds.join(','), () => GrammarService.loadGrammarPoints(grammarIds), { keepPrevious: true }).data;
    const pointCache = useMemo<Partial<Record<string, GrammarPoint>>>(
        () => Object.fromEntries((loadedPoints ?? []).map(p => [p.id, p])),
        [loadedPoints]
    );

    const persisted = usePersistedControlsSnapshot<PersistedListState>(LIST_STATE_KEY);
    const [searchQuery, setSearchQuery] = useState(persisted.searchQuery ?? "");
    const [sortField, setSortField] = useState<SortField>(persisted.sortField ?? 'added_date');
    const [sortDir, setSortDir] = useState<SortDirection>(persisted.sortDir ?? 'desc');
    // Mastered items are, by definition, the ones the user is done with - they'd
    // otherwise dominate the list for anyone with real history. Hidden by default,
    // but the count stays visible so it never looks like data went missing.
    const [showMastered, setShowMastered] = useState(persisted.showMastered ?? false);

    const [page, setPage] = useState(persisted.page ?? 1);
    const ITEMS_PER_PAGE = 30;

    const masteredCount = useMemo(
        () => progress.filter(g => isGrammarFullyMastered(g)).length,
        [progress]
    );

    // Filtering & Sorting
    const processedProgress = useMemo(() => {
        let gArray = [...progress];

        // 0. Hide fully-mastered items unless explicitly asked for.
        if (!showMastered) {
            gArray = gArray.filter(g => !isGrammarFullyMastered(g));
        }

        // 1. Search (matches title and explanations)
        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            gArray = gArray.filter(g => {
                const point = pointCache[g.grammarId];
                if (!point) return false;
                return (
                    point.title.toLowerCase().includes(q) ||
                    point.shortExplanation.toLowerCase().includes(q) ||
                    point.longExplanation.toLowerCase().includes(q)
                );
            });
        }

        // 2. Sort
        gArray.sort((a, b) => {
            let valA: number = 0;
            let valB: number = 0;

            switch (sortField) {
                case 'added_date':
                    valA = a.introductionAt ? new Date(a.introductionAt).getTime() : 0;
                    valB = b.introductionAt ? new Date(b.introductionAt).getTime() : 0;
                    break;
                case 'next_review':
                    valA = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 9999999999999;
                    valB = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 9999999999999;
                    break;
                case 'srs_stage':
                    valA = a.stage === 'graduated' ? 1 : 0;
                    valB = b.stage === 'graduated' ? 1 : 0;
                    break;
                case 'failures':
                    valA = a.entry?.history?.filter(h => h.result === 'wrong').length || 0;
                    valB = b.entry?.history?.filter(h => h.result === 'wrong').length || 0;
                    break;
                case 'jlpt_level':
                    valA = pointCache[a.grammarId]?.jlptLevel ?? 99;
                    valB = pointCache[b.grammarId]?.jlptLevel ?? 99;
                    break;
                case 'mastery':
                    valA = a.entry?.memoryStrength ?? 0;
                    valB = b.entry?.memoryStrength ?? 0;
                    break;
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return gArray;
    }, [progress, searchQuery, sortField, sortDir, pointCache, showMastered]);

    // Pagination
    const totalPages = Math.ceil(processedProgress.length / ITEMS_PER_PAGE) || 1;
    const displayedItems = processedProgress.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    // Reset page to 1 when the filter/sort changes - but NOT on the initial mount,
    // otherwise it would clobber the page restored from sessionStorage.
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        setPage(1);
    }, [searchQuery, sortField, sortDir, showMastered]);

    // Persist the list controls so returning from a grammar detail page restores them.
    usePersistControls<PersistedListState>(
        LIST_STATE_KEY,
        { searchQuery, sortField, sortDir, page, showMastered },
        [searchQuery, sortField, sortDir, page, showMastered],
    );

    // Fetch all grammar-point JSON files at once so search/sort filters instantly

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-lg shadow-sm border border-divider items-center justify-between">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tertiary" size={16} />
                    <input
                        type="text"
                        placeholder="Search title, explanation..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-divider rounded-md text-sm bg-surface text-primary placeholder:text-input-placeholder focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                    />
                </div>

                <div className="flex gap-2 items-center w-full md:w-auto">
                    <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                        className="px-3 py-2 border border-divider rounded-md text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent grow md:grow-0"
                    >
                        <option value="added_date">Date Added</option>
                        <option value="next_review">Next Review</option>
                        <option value="srs_stage">SRS Stage</option>
                        <option value="mastery">Mastery</option>
                        <option value="failures">Failure Count</option>
                        <option value="jlpt_level">JLPT Level</option>
                    </select>

                    <button
                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                        className="p-2 border border-divider rounded-md text-primary hover:bg-surface-hover"
                        title={sortDir === 'asc' ? "Ascending" : "Descending"}
                    >
                        {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                </div>
            </div>

            {masteredCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none -mt-1">
                    <input
                        type="checkbox"
                        checked={showMastered}
                        onChange={(e) => setShowMastered(e.target.checked)}
                        className="accent-accent w-4 h-4"
                    />
                    Show mastered
                    <span className="text-tertiary">({masteredCount})</span>
                </label>
            )}

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedItems.map((g) => {
                    const point = pointCache[g.grammarId];
                    if (!point) return <CardSkeleton key={g.grammarId} />;
                    return (
                        <GrammarCard
                            key={point.id}
                            point={point}
                            progress={g}
                            onClick={() => onGrammarClick?.(point.id)}
                        />
                    );
                })}
                {displayedItems.length === 0 && (
                    <div className="col-span-full py-12 text-center text-tertiary">
                        {!showMastered && masteredCount > 0
                            ? 'No unmastered grammar points found. Enable "Show mastered" to include mastered points.'
                            : 'No grammar points found.'}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button
                        variant="ghost"
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center text-sm text-secondary">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
