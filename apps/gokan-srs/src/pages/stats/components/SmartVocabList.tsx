import { useState, useEffect, useMemo, useRef } from "react";
import { usePersistControls, usePersistedControlsSnapshot } from "../../../hooks/usePersistedControls";
import type { VocabProgress, Vocabulary } from "../../../models/vocabulary.model";
import { VocabularyService } from "../../../services/vocabulary.service";
import { VocabCard } from "../../../components/VocabCard";
import { CardSkeleton } from "../../../components/CardSkeleton";
import { Search, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { romajiToHiragana, looksLikeRomaji } from "../../../utils/romaji";
import { isVocabFullyMastered } from "../../../services/scheduling";
import { countWrongReviews } from "../../../utils/winRate.utils";
import { useAsyncData } from "../../../hooks/useAsyncData";
import type { UserSettings } from "../../../models/user.model";

interface SmartVocabListProps {
    progress: VocabProgress[];
    settings?: UserSettings;
    onVocabClick?: (vocabId: string) => void;
}

type SortField = 'added_date' | 'srs_stage' | 'next_review' | 'failures' | 'kanji_rank' | 'reading_mastery' | 'meaning_mastery' | 'production_mastery';
type SortDirection = 'asc' | 'desc';

// The list controls persist across navigation (e.g. into a vocab detail page and
// back) so the user returns to the same sort/filter/page they left.
const LIST_STATE_KEY = 'gokan_stats_vocablist_state';

interface PersistedListState {
    searchQuery: string;
    sortField: SortField;
    sortDir: SortDirection;
    page: number;
    showMastered: boolean;
}


export function SmartVocabList({ progress, settings, onVocabClick }: SmartVocabListProps) {
    // Every word's file is loaded up front so search filters instantly; the service
    // caches them, so a later change to the list only fetches what is new.
    const vocabIds = useMemo(() => progress.map(p => p.vocabId), [progress]);
    const loadedVocabs = useAsyncData(vocabIds.join(','), () => VocabularyService.loadVocabs(vocabIds), { keepPrevious: true }).data;
    const vocabCache = useMemo<Partial<Record<string, Vocabulary>>>(
        () => Object.fromEntries((loadedVocabs ?? []).map(v => [v.id, v])),
        [loadedVocabs]
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

    // Load frequency index for sorting by kanji rank on unloaded items
    const frequencyIndex = useAsyncData('frequency-index', () => VocabularyService.loadFrequencyIndex()).data;
    const frequencyRanks = useMemo(() => {
        const ranks: Partial<Record<string, number>> = {};
        frequencyIndex?.forEach((entry, i) => { ranks[entry.id] = i; });
        return ranks;
    }, [frequencyIndex]);

    const masteredCount = useMemo(
        () => progress.filter(p => isVocabFullyMastered(p, settings)).length,
        [progress, settings]
    );

    // Filtering & Sorting
    const processedProgress = useMemo(() => {
        let pArray = [...progress];

        // 0. Hide fully-mastered items unless explicitly asked for.
        if (!showMastered) {
            pArray = pArray.filter(p => !isVocabFullyMastered(p, settings));
        }

        // 1. Search (matches kanji, reading, meaning; romaji is converted to kana
        //    so "nichi" matches にち)
        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            const kanaQuery = looksLikeRomaji(q) ? romajiToHiragana(q) : null;
            pArray = pArray.filter(p => {
                const v = vocabCache[p.vocabId];
                if (!v) return false;
                return (
                    v.writtenForm.kanji.includes(q) ||
                    v.reading.primary.includes(q) ||
                    (kanaQuery !== null && kanaQuery !== q && v.reading.primary.includes(kanaQuery)) ||
                    v.senses.some(s => s.glosses.some(g => g.toLowerCase().includes(q)))
                );
            });
        }

        // 2. Sort
        pArray.sort((a, b) => {
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
                    valA = countWrongReviews(a);
                    valB = countWrongReviews(b);
                    break;
                case 'kanji_rank':
                    valA = frequencyRanks[a.vocabId] ?? 99999;
                    valB = frequencyRanks[b.vocabId] ?? 99999;
                    break;
                case 'reading_mastery':
                    valA = a.reading?.memoryStrength ?? 0;
                    valB = b.reading?.memoryStrength ?? 0;
                    break;
                case 'meaning_mastery':
                    valA = a.meaning?.memoryStrength ?? 0;
                    valB = b.meaning?.memoryStrength ?? 0;
                    break;
                case 'production_mastery':
                    valA = a.production?.memoryStrength ?? 0;
                    valB = b.production?.memoryStrength ?? 0;
                    break;
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return pArray;
    }, [progress, searchQuery, sortField, sortDir, vocabCache, frequencyRanks, showMastered, settings]);

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

    // Persist the list controls so returning from a detail page restores them.
    usePersistControls<PersistedListState>(
        LIST_STATE_KEY,
        { searchQuery, sortField, sortDir, page, showMastered },
        [searchQuery, sortField, sortDir, page, showMastered],
    );


    // Remove the full-screen skeleton block so the search input stays usable immediately,
    // and let the grid render individual CardSkeletons instead.

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-lg shadow-sm border border-divider items-center justify-between">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tertiary" size={16} />
                    <input
                        type="text"
                        placeholder="Search reading, meaning..."
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
                        <option value="reading_mastery">Reading Advancement</option>
                        <option value="meaning_mastery">Meaning Advancement</option>
                        <option value="production_mastery">Production Advancement</option>
                        <option value="failures">Failure Count</option>
                        <option value="kanji_rank">Frequency</option>
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
                {displayedItems.map((p) => {
                    const vocab = vocabCache[p.vocabId];
                    if (!vocab) return <CardSkeleton key={p.vocabId} />;
                    return (
                        <VocabCard
                            key={vocab.id}
                            vocab={vocab}
                            progress={p}
                            onClick={() => onVocabClick?.(vocab.id)}
                        />
                    );
                })}
                {displayedItems.length === 0 && (
                    <div className="col-span-full py-12 text-center text-tertiary">
                        {!showMastered && masteredCount > 0
                            ? 'No unmastered vocabulary found. Enable "Show mastered" to include mastered words.'
                            : 'No vocabulary found.'}
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
