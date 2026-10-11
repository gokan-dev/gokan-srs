import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import { VocabularyService } from "../../services/vocabulary.service";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useNow } from "../../hooks/useNow";
import { usePersistControls, usePersistedControlsSnapshot } from "../../hooks/usePersistedControls";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { ListRow } from "../../components/ui/ListRow";
import { FilterToggle } from "../../components/ui/FilterToggle";
import { JlptChip } from "../../components/JlptChip";
import { MasteryRing } from "../../components/MasteryRing";
import { Pagination } from "../../components/ui/Pagination";
import { CardSkeleton } from "../../components/CardSkeleton";
import { isProductionActivated, isReadingRelevant, isVocabFullyMastered, vocabNextReviewAt } from "../../services/scheduling";
import { formatTimeUntil } from "../../utils/time.utils";
import { commonSortOptions, type SortOption } from "../../utils/smartList.utils";
import { countWrongReviews } from "../../utils/winRate.utils";
import { matchesVocabStatus, VOCAB_STATUS_LABEL, type VocabStatusFilter } from "../../utils/vocabStatus.utils";
import type { VocabProgress } from "../../models/vocabulary.model";

const STATE_KEY = 'gokan_vocab_list_state';
const PAGE_SIZE = 50;
const STATUSES: VocabStatusFilter[] = ['due', 'learning', 'mastered', 'struggling', 'all'];
const LEVELS = [5, 4, 3, 2, 1];

type SortField = 'added_date' | 'next_review' | 'failures' | 'kanji_rank' | 'reading_mastery' | 'meaning_mastery' | 'production_mastery';

interface PersistedVocabListState {
    query: string;
    status: VocabStatusFilter;
    jlptLevel: number | null;
    sortField: SortField;
    page: number;
}

function isUrlStatus(value: string | null): value is VocabStatusFilter {
    return value !== null && (STATUSES as string[]).includes(value);
}

export function VocabularyListScreen() {
    const { state } = useQuiz();
    const [searchParams] = useSearchParams();
    const now = useNow();

    const progress = useMemo(() => state.progress?.learningQueue ?? [], [state.progress]);
    const settings = state.settings ?? undefined;

    const persisted = usePersistedControlsSnapshot<PersistedVocabListState>(STATE_KEY);
    const urlStatus = searchParams.get('status');
    const [query, setQuery] = useState(persisted.query ?? '');
    const [status, setStatus] = useState<VocabStatusFilter>(
        isUrlStatus(urlStatus) ? urlStatus : (persisted.status ?? 'learning')
    );
    const [jlptLevel, setJlptLevel] = useState<number | null>(persisted.jlptLevel ?? null);
    const [sortField, setSortField] = useState<SortField>(persisted.sortField ?? 'next_review');
    const [page, setPage] = useState(persisted.page ?? 1);

    const changeView = (apply: () => void) => {
        apply();
        setPage(1);
    };

    const frequencyIndex = useAsyncData('frequency-index', () => VocabularyService.loadFrequencyIndex()).data;
    const ids = useMemo(() => progress.map(p => p.vocabId), [progress]);
    const items = useAsyncData(ids.join(','), () => VocabularyService.loadVocabs(ids), { keepPrevious: true }).data;
    const itemById = useMemo(() => new Map((items ?? []).map(v => [v.id, v])), [items]);

    const sortOptions = useMemo((): SortOption<SortField, VocabProgress, Vocabulary>[] => {
        const frequencyRank = new Map(frequencyIndex?.map((entry, i) => [entry.id, i]) ?? []);
        return [
            ...commonSortOptions<VocabProgress, Vocabulary>(countWrongReviews).filter(o => o.value !== 'srs_stage') as SortOption<SortField, VocabProgress, Vocabulary>[],
            { value: 'reading_mastery', label: 'Reading mastery', sortKey: p => p.reading.memoryStrength },
            { value: 'meaning_mastery', label: 'Meaning mastery', sortKey: p => p.meaning.memoryStrength },
            { value: 'production_mastery', label: 'Production mastery', sortKey: p => p.production?.memoryStrength ?? 0 },
            { value: 'kanji_rank', label: 'Frequency', sortKey: p => frequencyRank.get(p.vocabId) ?? Number.MAX_SAFE_INTEGER },
        ];
    }, [frequencyIndex]);

    const statusCounts = useMemo(() => {
        const nowDate = new Date(now);
        const counts: Record<VocabStatusFilter, number> = { due: 0, learning: 0, mastered: 0, struggling: 0, all: progress.length };
        for (const p of progress) {
            for (const s of STATUSES) {
                if (s !== 'all' && matchesVocabStatus(p, s, settings, nowDate)) counts[s]++;
            }
        }
        return counts;
    }, [progress, settings, now]);

    const masteredCount = useMemo(() => progress.filter(p => isVocabFullyMastered(p, settings)).length, [progress, settings]);

    const shown = useMemo(() => {
        const nowDate = new Date(now);
        const q = query.toLowerCase().trim();
        const option = sortOptions.find(o => o.value === sortField) ?? sortOptions[0];
        return progress
            .filter(p => matchesVocabStatus(p, status, settings, nowDate))
            .filter(p => jlptLevel === null || itemById.get(p.vocabId)?.jlptLevel === jlptLevel)
            .filter(p => {
                if (!q) return true;
                const item = itemById.get(p.vocabId);
                if (!item) return false;
                return item.writtenForm.kanji.includes(q)
                    || item.reading.primary.includes(q)
                    || item.senses.some(s => s.glosses.some(g => g.toLowerCase().includes(q)));
            })
            .map(p => ({ p, key: option.sortKey(p, itemById.get(p.vocabId)) }))
            .sort((a, b) => a.key - b.key)
            .map(({ p }) => p);
    }, [progress, query, status, jlptLevel, sortField, sortOptions, itemById, settings, now]);

    const totalPages = Math.ceil(shown.length / PAGE_SIZE) || 1;
    const displayed = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    usePersistControls<PersistedVocabListState>(
        STATE_KEY,
        { query, status, jlptLevel, sortField, page },
        [query, status, jlptLevel, sortField, page],
    );

    return (
        <Page width="wide">
            <PageHeader
                title="Vocabulary"
                subtitle={`${progress.length} words · ${masteredCount} mastered`}
                parentPath="/"
                className="mb-6"
            />

            <div className="flex flex-col gap-3 mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={e => changeView(() => setQuery(e.target.value))}
                    placeholder="Search word, reading or meaning"
                    className="w-full bg-surface border border-divider rounded-md px-3 py-2 text-base md:text-sm font-gothic text-primary placeholder:text-input-placeholder outline-none focus:border-accent"
                />

                <div className="flex flex-wrap items-center gap-2">
                    {STATUSES.map(s => (
                        <FilterToggle key={s} active={status === s} onClick={() => changeView(() => setStatus(s))}>
                            {VOCAB_STATUS_LABEL[s]} ({statusCounts[s]})
                        </FilterToggle>
                    ))}

                    <select
                        value={jlptLevel ?? ''}
                        onChange={e => changeView(() => setJlptLevel(e.target.value ? Number(e.target.value) : null))}
                        className="ml-auto px-2 py-1 border border-divider rounded-md text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                    >
                        <option value="">Any level</option>
                        {LEVELS.map(level => <option key={level} value={level}>N{level}</option>)}
                    </select>

                    <select
                        value={sortField}
                        onChange={e => changeView(() => setSortField(e.target.value as SortField))}
                        className="px-2 py-1 border border-divider rounded-md text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                    >
                        {sortOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                {displayed.map(p => {
                    const item = itemById.get(p.vocabId);
                    if (!item) return <CardSkeleton key={p.vocabId} />;
                    const due = vocabNextReviewAt(p, settings);
                    const readingRelevant = isReadingRelevant(p);
                    const productionActive = isProductionActivated(p.production);
                    return (
                        <ListRow
                            key={p.vocabId}
                            to={`/vocab/${p.vocabId}`}
                            trailing={
                                <div className="flex items-center gap-3">
                                    {readingRelevant && <MasteryRing memoryStrength={p.reading.memoryStrength} size={22} showText={false} variant="reading" />}
                                    <MasteryRing memoryStrength={p.meaning.memoryStrength} size={22} showText={false} variant="meaning" />
                                    {productionActive && <MasteryRing memoryStrength={p.production?.memoryStrength ?? 0} size={22} showText={false} variant="production" />}
                                    <span className="type-meta w-20 text-right">
                                        {isVocabFullyMastered(p, settings) ? 'Mastered' : formatTimeUntil(due, now)}
                                    </span>
                                    {item.jlptLevel && <JlptChip level={item.jlptLevel} />}
                                </div>
                            }
                        >
                            <div className="flex items-baseline gap-2">
                                <span className="jp-headword">{headwordOf(item)}</span>
                                <span className="type-support">{secondaryForm(item)}</span>
                            </div>
                            <div className="type-body truncate">
                                {item.senses[0]?.glosses.join(', ') ?? ''}
                            </div>
                        </ListRow>
                    );
                })}

                {displayed.length === 0 && (
                    <div className="py-12 text-center text-tertiary">No words match these filters.</div>
                )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </Page>
    );
}
