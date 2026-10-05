import { useMemo, useState, type ReactNode } from "react";
import { Search, ArrowDown, ArrowUp } from "lucide-react";
import { usePersistControls, usePersistedControlsSnapshot } from "../hooks/usePersistedControls";
import { useAsyncData } from "../hooks/useAsyncData";
import { CardSkeleton } from "./CardSkeleton";
import { Pagination } from "./ui/Pagination";
import type { SortOption } from "../utils/smartList.utils";

type SortDirection = 'asc' | 'desc';

interface PersistedListState<S extends string> {
    searchQuery: string;
    sortField: S;
    sortDir: SortDirection;
    page: number;
    showMastered: boolean;
}

interface SmartListProps<P, I, S extends string> {
    /** sessionStorage key for the controls, so coming back from a detail page restores them. */
    storageKey: string;
    progress: P[];
    idOf: (progress: P) => string;
    /** Loads every item's file at once (cached by the service), so search filters instantly. */
    loadItems: (ids: string[]) => Promise<I[]>;
    itemIdOf: (item: I) => string;
    isMastered: (progress: P) => boolean;
    matchesSearch: (item: I, query: string) => boolean;
    searchPlaceholder: string;
    sortOptions: SortOption<S, P, I>[];
    defaultSort: S;
    /** Plural noun for the empty states, e.g. "vocabulary" or "grammar points". */
    noun: string;
    renderCard: (progress: P, item: I) => ReactNode;
}

const ITEMS_PER_PAGE = 30;

/**
 * The Stats screen's searchable, sortable, paginated list of studied items. The vocab
 * and grammar lists are thin wrappers that supply how to load, search, sort and draw an
 * item; everything else (controls, mastered toggle, paging, persistence) lives here once.
 */
export function SmartList<P, I, S extends string>({
    storageKey, progress, idOf, loadItems, itemIdOf, isMastered, matchesSearch,
    searchPlaceholder, sortOptions, defaultSort, noun, renderCard,
}: SmartListProps<P, I, S>) {
    const ids = useMemo(() => progress.map(idOf), [progress, idOf]);
    const loaded = useAsyncData(ids.join(','), () => loadItems(ids), { keepPrevious: true }).data;
    const itemById = useMemo(() => new Map((loaded ?? []).map(item => [itemIdOf(item), item])), [loaded, itemIdOf]);

    const persisted = usePersistedControlsSnapshot<PersistedListState<S>>(storageKey);
    const [searchQuery, setSearchQuery] = useState(persisted.searchQuery ?? '');
    const [sortField, setSortField] = useState<S>(persisted.sortField ?? defaultSort);
    const [sortDir, setSortDir] = useState<SortDirection>(persisted.sortDir ?? 'desc');
    // Mastered items are the ones the user is done with; they would otherwise dominate
    // the list for anyone with real history. Hidden by default, but counted, so it never
    // looks like data went missing.
    const [showMastered, setShowMastered] = useState(persisted.showMastered ?? false);
    const [page, setPage] = useState(persisted.page ?? 1);

    // Any change to what is shown starts again from the first page.
    const changeView = (apply: () => void) => {
        apply();
        setPage(1);
    };

    const masteredCount = useMemo(() => progress.filter(isMastered).length, [progress, isMastered]);

    const shown = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const option = sortOptions.find(o => o.value === sortField) ?? sortOptions[0];
        const direction = sortDir === 'asc' ? 1 : -1;
        return progress
            .filter(p => showMastered || !isMastered(p))
            .filter(p => {
                if (!query) return true;
                const item = itemById.get(idOf(p));
                return item !== undefined && matchesSearch(item, query);
            })
            .map(p => ({ p, key: option.sortKey(p, itemById.get(idOf(p))) }))
            .sort((a, b) => (a.key - b.key) * direction)
            .map(({ p }) => p);
    }, [progress, searchQuery, sortField, sortDir, showMastered, itemById, sortOptions, isMastered, matchesSearch, idOf]);

    const totalPages = Math.ceil(shown.length / ITEMS_PER_PAGE) || 1;
    const displayed = shown.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    usePersistControls<PersistedListState<S>>(
        storageKey,
        { searchQuery, sortField, sortDir, page, showMastered },
        [searchQuery, sortField, sortDir, page, showMastered],
    );

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-lg shadow-sm border border-divider items-center justify-between">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tertiary" size={16} />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => changeView(() => setSearchQuery(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 border border-divider rounded-md text-sm bg-surface text-primary placeholder:text-input-placeholder focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                    />
                </div>

                <div className="flex gap-2 items-center w-full md:w-auto">
                    <select
                        value={sortField}
                        onChange={(e) => {
                            const option = sortOptions.find(o => o.value === e.target.value);
                            if (option) changeView(() => setSortField(option.value));
                        }}
                        className="px-3 py-2 border border-divider rounded-md text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent grow md:grow-0"
                    >
                        {sortOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => changeView(() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc'))}
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
                        onChange={(e) => changeView(() => setShowMastered(e.target.checked))}
                        className="accent-accent w-4 h-4"
                    />
                    Show mastered
                    <span className="text-tertiary">({masteredCount})</span>
                </label>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayed.map(p => {
                    const item = itemById.get(idOf(p));
                    return item ? renderCard(p, item) : <CardSkeleton key={idOf(p)} />;
                })}
                {displayed.length === 0 && (
                    <div className="col-span-full py-12 text-center text-tertiary">
                        {!showMastered && masteredCount > 0
                            ? `No unmastered ${noun} found. Enable "Show mastered" to include mastered ones.`
                            : `No ${noun} found.`}
                    </div>
                )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
}
