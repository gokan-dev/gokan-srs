import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
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
import { ArrowDownUp } from "lucide-react";
import { formatTimeUntil } from "../../utils/time.utils";
import { matchesVocabStatus, vocabSortKey, VOCAB_SORT_LABEL, VOCAB_STATUS_LABEL, type VocabSort, type VocabStatusFilter } from "../../utils/vocabStatus.utils";
import { looksLikeRomaji, romajiToHiragana, toHiragana } from "../../utils/romaji";

const STATE_KEY = 'gokan_vocab_list_state';
const PAGE_SIZE = 50;
const STATUSES: VocabStatusFilter[] = ['due', 'learning', 'mastered', 'struggling', 'all'];
const LEVELS = [5, 4, 3, 2, 1];

const SORTS = Object.keys(VOCAB_SORT_LABEL) as VocabSort[];

/** Fixed column widths, shared by the header row and every row so they line up. */
const RING_COLUMN = 'w-20 flex justify-center';
const NEXT_COLUMN = 'w-20 text-right';
const JLPT_COLUMN = 'w-10 flex justify-end';

interface PersistedVocabListState {
    query: string;
    status: VocabStatusFilter;
    jlptLevel: number | null;
    sort: VocabSort;
    reversed: boolean;
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
    const [sort, setSort] = useState<VocabSort>(persisted.sort ?? 'next_review');
    const [reversed, setReversed] = useState(persisted.reversed ?? false);
    const [page, setPage] = useState(persisted.page ?? 1);

    const changeView = (apply: () => void) => {
        apply();
        setPage(1);
    };

    const frequencyIndex = useAsyncData('frequency-index', () => VocabularyService.loadFrequencyIndex()).data;
    const ids = useMemo(() => progress.map(p => p.vocabId), [progress]);
    const items = useAsyncData(ids.join(','), () => VocabularyService.loadVocabs(ids), { keepPrevious: true }).data;
    const itemById = useMemo(() => new Map((items ?? []).map(v => [v.id, v])), [items]);

    const frequencyRank = useMemo(() => new Map(frequencyIndex?.map((entry, i) => [entry.id, i]) ?? []), [frequencyIndex]);

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
        // Romaji typed in the search also finds the kana reading.
        const qKana = q && looksLikeRomaji(q) ? romajiToHiragana(q) : '';
        const context = { settings, frequencyRank };
        const direction = reversed ? -1 : 1;
        return progress
            .filter(p => matchesVocabStatus(p, status, settings, nowDate))
            .filter(p => jlptLevel === null || itemById.get(p.vocabId)?.jlptLevel === jlptLevel)
            .filter(p => {
                if (!q) return true;
                const item = itemById.get(p.vocabId);
                if (!item) return false;
                return item.writtenForm.kanji.includes(q)
                    || item.reading.primary.includes(q)
                    || (qKana !== '' && toHiragana(item.reading.primary).includes(qKana))
                    || item.senses.some(s => s.glosses.some(g => g.toLowerCase().includes(q)));
            })
            .map(p => ({ p, key: vocabSortKey(p, sort, context) }))
            .sort((a, b) => direction * (a.key - b.key))
            .map(({ p }) => p);
    }, [progress, query, status, jlptLevel, sort, reversed, frequencyRank, itemById, settings, now]);

    const totalPages = Math.ceil(shown.length / PAGE_SIZE) || 1;
    const displayed = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    usePersistControls<PersistedVocabListState>(
        STATE_KEY,
        { query, status, jlptLevel, sort, reversed, page },
        [query, status, jlptLevel, sort, reversed, page],
    );

    return (
        <Page width="wide">
            <PageHeader
                title="Vocabulary"
                subtitle={`${progress.length.toLocaleString('en-US')} words · ${masteredCount.toLocaleString('en-US')} mastered`}
                className="mb-8"
            />

            <div className="flex flex-col gap-3 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={e => changeView(() => setQuery(e.target.value))}
                    placeholder="Search word, reading or meaning"
                    aria-label="Search your vocabulary"
                    className="w-full bg-surface border border-divider rounded-md px-3 py-2 text-base md:text-sm font-sans text-primary placeholder:text-input-placeholder outline-none focus:border-accent"
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status">
                        {STATUSES.map(s => (
                            <FilterToggle key={s} active={status === s} onClick={() => changeView(() => setStatus(s))}>
                                {VOCAB_STATUS_LABEL[s]} <span className="tabular-nums opacity-75">{statusCounts[s].toLocaleString('en-US')}</span>
                            </FilterToggle>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                        <select
                            value={jlptLevel ?? ''}
                            onChange={e => changeView(() => setJlptLevel(e.target.value ? Number(e.target.value) : null))}
                            aria-label="JLPT level"
                            className="h-8 px-2 border border-divider rounded-md text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                        >
                            <option value="">Any level</option>
                            {LEVELS.map(level => <option key={level} value={level}>N{level}</option>)}
                        </select>

                        <select
                            value={sort}
                            onChange={e => changeView(() => setSort(SORTS.find(option => option === e.target.value) ?? 'next_review'))}
                            aria-label="Sort"
                            className="h-8 px-2 border border-divider rounded-md text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                        >
                            {SORTS.map(option => <option key={option} value={option}>{VOCAB_SORT_LABEL[option]}</option>)}
                        </select>

                        <button
                            type="button"
                            onClick={() => changeView(() => setReversed(r => !r))}
                            aria-pressed={reversed}
                            aria-label="Reverse the order"
                            title="Reverse the order"
                            className={`h-8 w-8 flex items-center justify-center rounded-md border transition-colors cursor-pointer ${reversed ? 'border-accent text-accent bg-accent/10' : 'border-divider text-secondary hover:bg-surface-hover'}`}
                        >
                            <ArrowDownUp size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Column headers: they are the rings' legend. */}
            <div className="hidden md:flex items-center gap-3 px-3 pb-2 border-b border-divider type-meta" aria-hidden="true">
                <span className="flex-1">Word</span>
                <span className={RING_COLUMN}>Reading</span>
                <span className={RING_COLUMN}>Meaning</span>
                <span className={RING_COLUMN}>Production</span>
                <span className={NEXT_COLUMN}>Next review</span>
                <span className={JLPT_COLUMN}>JLPT</span>
            </div>

            <div className="flex flex-col divide-y divide-divider">
                {displayed.map(p => {
                    const item = itemById.get(p.vocabId);
                    if (!item) return <CardSkeleton key={p.vocabId} />;
                    const due = vocabNextReviewAt(p, settings);
                    const gloss = item.senses[0]?.glosses.join(', ') ?? '';
                    return (
                        <ListRow
                            key={p.vocabId}
                            to={`/vocab/${p.vocabId}`}
                            className="min-h-16"
                            trailing={
                                <div className="flex items-center gap-3">
                                    <span className={`hidden md:flex ${RING_COLUMN}`}>
                                        {isReadingRelevant(p) && <MasteryRing memoryStrength={p.reading.memoryStrength} size={22} showText={false} variant="reading" label="Reading" />}
                                    </span>
                                    <span className={`hidden md:flex ${RING_COLUMN}`}>
                                        <MasteryRing memoryStrength={p.meaning.memoryStrength} size={22} showText={false} variant="meaning" label="Meaning" />
                                    </span>
                                    <span className={`hidden md:flex ${RING_COLUMN}`}>
                                        {isProductionActivated(p.production) && <MasteryRing memoryStrength={p.production?.memoryStrength ?? 0} size={22} showText={false} variant="production" label="Production" />}
                                    </span>
                                    <span className={`type-meta ${NEXT_COLUMN}`}>
                                        {isVocabFullyMastered(p, settings) ? 'Mastered' : formatTimeUntil(due, now)}
                                    </span>
                                    <span className={`hidden md:flex ${JLPT_COLUMN}`}>
                                        {item.jlptLevel && <JlptChip level={item.jlptLevel} />}
                                    </span>
                                </div>
                            }
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="min-w-0 md:w-40 md:shrink-0">
                                    <div className="jp-headword truncate">{headwordOf(item)}</div>
                                    <div className="type-support truncate">{secondaryForm(item)}</div>
                                </div>
                                <div className="hidden md:block flex-1 min-w-0 type-body truncate">{gloss}</div>
                            </div>
                            <div className="md:hidden type-support truncate mt-0.5">{gloss}</div>
                        </ListRow>
                    );
                })}

                {displayed.length === 0 && (
                    <div className="py-12 text-center type-support">No words match these filters.</div>
                )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </Page>
    );
}
