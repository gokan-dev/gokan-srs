import { useMemo, useState } from "react";
import { usePersistControls, usePersistedControlsSnapshot } from "../../hooks/usePersistedControls";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { GrammarAxis, GrammarBrowseIndex, GrammarBrowseRow, GrammarPoint } from "@gokan/dataset-schema";
import { GrammarService } from "../../services/grammar.service";
import { useQuiz } from "../../context/useQuiz";
import { FilterToggle } from "../../components/ui/FilterToggle";
import { ListRow } from "../../components/ui/ListRow";
import { StatusDot } from "../../components/StatusDot";
import { Page } from "../../components/Page";
import { useAsyncData } from "../../hooks/useAsyncData";
import { grammarLearningStatus, STATUS_LABEL } from "../../utils/learningStatus.utils";
import { GRAMMAR_SORT_LABEL, matchesGrammarStatus, sortGrammarRows, type GrammarSort, type GrammarStatusFilter } from "../../utils/grammarBrowse.utils";
import type { GrammarProgress } from "../../models/grammar.model";
import { GrammarHomeHeader } from "./GrammarHomeHeader";

type Kind = NonNullable<GrammarPoint['kind']>;
type GroupMode = 'level' | 'family';

/** Which exercise a point is drilled by: dataset detail, shown as neutral text. */
const KIND_LABEL: Record<Kind, { label: string; quiz: string }> = {
    'construction': { label: 'Construction', quiz: 'Sentence cloze' },
    'inflection': { label: 'Inflection', quiz: 'Conjugation drill' },
    'lexical': { label: 'Lexical', quiz: 'Sentence cloze' },
};

/** What differentiates a family's members, which decides how they are taught. */
const AXIS_LABEL: Record<GrammarAxis, string> = {
    'register': 'Register ladder',
    'constraint': 'Constraint',
    'variant': 'Interchangeable',
};

const FORMALITY_LABEL: Record<string, string> = {
    'casual': 'Casual', 'neutral': 'Neutral', 'polite': 'Polite',
    'formal': 'Formal', 'very-formal-literary': 'Literary',
};

const LEVELS = [5, 4, 3, 2, 1];
const STATUSES: GrammarStatusFilter[] = ['all', 'new', 'learning', 'mastered'];
const SORTS = Object.keys(GRAMMAR_SORT_LABEL) as GrammarSort[];

const BROWSE_STATE_KEY = 'gokan_grammar_browse_state';

/**
 * Sets are stored as arrays: JSON.stringify turns a Set into `{}`, which would silently persist
 * every multi-select filter as empty and look like the filters simply were not kept.
 */
interface PersistedBrowseState {
    query: string;
    levels: number[];
    status: GrammarStatusFilter;
    sort: GrammarSort;
    kinds: Kind[];
    axes: GrammarAxis[];
    onlyVariants: boolean;
    onlyFamilied: boolean;
    group: GroupMode;
    datasetDetails: boolean;
}

/** The dataset's view of a point, one neutral line under the row (Dataset details only). */
function datasetLine(row: GrammarBrowseRow): string {
    return [
        row.id,
        KIND_LABEL[row.kind]?.quiz,
        row.derives,
        row.formalityLevel ? FORMALITY_LABEL[row.formalityLevel] ?? row.formalityLevel : null,
        row.axis ? AXIS_LABEL[row.axis] : null,
        row.variantOf ? `${row.variantRelation ?? 'variant'} of ${row.variantOf}` : null,
        row.orderIndex !== null ? `#${row.orderIndex + 1} in order` : (row.variantOf ? null : 'not introduced'),
        row.chapterTitle,
        `${row.anchoredExampleCount}/${row.exampleCount} anchored examples`,
        row.conjugationItems !== undefined ? `${row.conjugationItems} drill items` : null,
    ].filter(Boolean).join(' · ');
}

function PointRow({ row, progress, datasetDetails }: { row: GrammarBrowseRow; progress: GrammarProgress | undefined; datasetDetails: boolean }) {
    return (
        <ListRow to={`/grammar/${row.id}`} trailing={<StatusDot status={grammarLearningStatus(progress)} />}>
            <div className="flex items-baseline gap-2 min-w-0">
                <span className="jp-headword truncate">{row.title}</span>
                {row.romaji && <span className="type-meta truncate">{row.romaji}</span>}
            </div>
            <p className="type-support line-clamp-2">{row.shortExplanation}</p>
            {datasetDetails && <p className="type-meta mt-1">{datasetLine(row)}</p>}
        </ListRow>
    );
}

function StatTile({ value, label, detail }: { value: React.ReactNode; label: string; detail?: string }) {
    return (
        <div className="flex-1 min-w-[132px] rounded-md border border-divider p-3">
            <p className="font-sans text-xl text-primary tabular-nums">{value}</p>
            <p className="type-support">{label}</p>
            {detail && <p className="type-meta">{detail}</p>}
        </div>
    );
}

/**
 * Route /grammar/browse, the Grammar home's All points tab: every point grouped by
 * JLPT level in teaching order (or by near-synonym family), each with the
 * learner's status, with search, level and status filters and a sort.
 *
 * The Dataset details switch (off by default, persisted) restores the
 * inspection view this page used to be: the dataset's numbers per row, the
 * coverage tiles, the dataset filters, and the points outside the teaching
 * order (realization variants, taught through their canonical point).
 */
export function GrammarBrowseScreen() {
    const { state } = useQuiz();
    const indexLoad = useAsyncData('grammar-browse-index', () => GrammarService.loadBrowseIndex());
    const index: GrammarBrowseIndex | null = indexLoad.data ?? null;
    const failed = indexLoad.status === 'error' || (indexLoad.status === 'ready' && !indexLoad.data);
    // Families with at least one authored contrast lesson, so the family grouping
    // can link out to the page comparing them.
    const familiesWithLessons = useAsyncData('families-with-lessons', async () => new Set(
        Object.entries(await GrammarService.loadContrasts())
            .filter(([, entry]) => entry.lessons.length > 0)
            .map(([familyId]) => familyId)
    )).data ?? new Set<string>();

    const progressById = useMemo(
        () => new Map((state.progress?.grammarQueue ?? []).map(g => [g.grammarId, g])),
        [state.progress],
    );

    const persisted = usePersistedControlsSnapshot<PersistedBrowseState>(BROWSE_STATE_KEY);

    const [query, setQuery] = useState(persisted.query ?? '');
    const [levels, setLevels] = useState<Set<number>>(() => new Set(persisted.levels ?? []));
    const [status, setStatus] = useState<GrammarStatusFilter>(persisted.status ?? 'all');
    const [sort, setSort] = useState<GrammarSort>(persisted.sort ?? 'teaching');
    const [kinds, setKinds] = useState<Set<Kind>>(() => new Set(persisted.kinds ?? []));
    const [axes, setAxes] = useState<Set<GrammarAxis>>(() => new Set(persisted.axes ?? []));
    const [onlyVariants, setOnlyVariants] = useState(persisted.onlyVariants ?? false);
    const [onlyFamilied, setOnlyFamilied] = useState(persisted.onlyFamilied ?? false);
    const [group, setGroup] = useState<GroupMode>(persisted.group ?? 'level');
    const [datasetDetails, setDatasetDetails] = useState(persisted.datasetDetails ?? false);

    usePersistControls<PersistedBrowseState>(
        BROWSE_STATE_KEY,
        {
            query,
            levels: [...levels],
            status,
            sort,
            kinds: [...kinds],
            axes: [...axes],
            onlyVariants,
            onlyFamilied,
            group,
            datasetDetails,
        },
        [query, levels, status, sort, kinds, axes, onlyVariants, onlyFamilied, group, datasetDetails],
    );

    const toggle = <T,>(set: Set<T>, value: T, apply: (next: Set<T>) => void) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        apply(next);
    };

    const filtered = useMemo(() => {
        if (!index) return [];
        const q = query.trim().toLowerCase();
        const rows = index.points.filter(row => {
            // Points outside the teaching order are not studied on their own.
            if (!datasetDetails && row.orderIndex === null) return false;
            if (levels.size > 0 && !levels.has(row.jlptLevel)) return false;
            if (!matchesGrammarStatus(progressById.get(row.id), status)) return false;
            if (datasetDetails) {
                if (kinds.size > 0 && !kinds.has(row.kind)) return false;
                if (axes.size > 0 && (!row.axis || !axes.has(row.axis))) return false;
                if (onlyVariants && !row.variantOf) return false;
                if (onlyFamilied && !row.familyId) return false;
            }
            if (!q) return true;
            return (
                row.title.toLowerCase().includes(q)
                || (row.romaji ?? '').toLowerCase().includes(q)
                || row.id.includes(q)
                || row.shortExplanation.toLowerCase().includes(q)
                || (row.usageNote ?? '').toLowerCase().includes(q)
                || (row.familyName ?? '').toLowerCase().includes(q)
                || row.formation.toLowerCase().includes(q)
            );
        });
        return sortGrammarRows(rows, sort, progressById);
    }, [index, query, levels, status, sort, kinds, axes, onlyVariants, onlyFamilied, datasetDetails, progressById]);

    /** By level in level order; by family, the biggest families first. Rows keep the chosen sort inside a group. */
    const groups = useMemo(() => {
        if (group === 'level') {
            return LEVELS
                .map(level => ({ key: `N${level}`, title: `N${level}`, subtitle: '', rows: filtered.filter(r => r.jlptLevel === level) }))
                .filter(g => g.rows.length > 0);
        }

        const byFamily = new Map<string, GrammarBrowseRow[]>();
        const unfamilied: GrammarBrowseRow[] = [];
        for (const row of filtered) {
            if (!row.familyId) { unfamilied.push(row); continue; }
            const list = byFamily.get(row.familyId) ?? [];
            list.push(row);
            byFamily.set(row.familyId, list);
        }

        const familyGroups = [...byFamily.entries()]
            .map(([id, rows]) => ({
                key: id,
                title: rows[0].familyName ?? id,
                subtitle: `${rows.length} point${rows.length > 1 ? 's' : ''}`,
                rows,
            }))
            .sort((a, b) => b.rows.length - a.rows.length || a.title.localeCompare(b.title));

        if (unfamilied.length > 0) {
            familyGroups.push({ key: '__none__', title: 'No family', subtitle: `${unfamilied.length} points`, rows: unfamilied });
        }
        return familyGroups;
    }, [filtered, group]);

    if (failed || !index) {
        return (
            <Page width="wide">
                <GrammarHomeHeader stats={null} />
                <p className="type-support">{failed ? 'Could not load the grammar points.' : 'Loading grammar points...'}</p>
            </Page>
        );
    }

    const { stats } = index;
    // Only the kinds that have points: a filter that empties the list reads as a bug.
    const presentKinds = (Object.keys(KIND_LABEL) as Kind[]).filter(kind => (stats.byKind[kind] ?? 0) > 0);
    const hasFilters = levels.size > 0 || status !== 'all' || query !== ''
        || (datasetDetails && (kinds.size > 0 || axes.size > 0 || onlyVariants || onlyFamilied));

    return (
        <Page width="wide">
            <GrammarHomeHeader stats={stats} />

            {datasetDetails && (
                <div className="flex flex-wrap gap-2 mb-8">
                    {presentKinds.map(kind => (
                        <StatTile key={kind} value={stats.byKind[kind] ?? 0} label={KIND_LABEL[kind].label} detail={KIND_LABEL[kind].quiz} />
                    ))}
                    <StatTile value={stats.families} label="Families" detail={`${stats.unfamilied} not in a family`} />
                    <StatTile value={stats.variantGroups} label="Variant groups" detail={`${stats.variants} not introduced`} />
                    <StatTile
                        value={`${stats.byAxis.register ?? 0}/${stats.byAxis.constraint ?? 0}/${stats.byAxis.variant ?? 0}`}
                        label="Register / constraint / variant"
                    />
                </div>
            )}

            <div className="space-y-3 mb-8">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search title, romaji, explanation or formation"
                    aria-label="Search grammar points"
                    className="w-full bg-surface border border-divider rounded-md px-3 py-2 text-base md:text-sm font-sans text-primary placeholder:text-input-placeholder outline-none focus:border-accent"
                />

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Level">
                        {LEVELS.map(level => (
                            <FilterToggle key={level} active={levels.has(level)} onClick={() => toggle(levels, level, setLevels)}>
                                N{level}
                            </FilterToggle>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status">
                        {STATUSES.map(s => (
                            <FilterToggle key={s} active={status === s} onClick={() => setStatus(s)}>
                                {s === 'all' ? 'All' : STATUS_LABEL[s]}
                            </FilterToggle>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                        <select
                            value={sort}
                            onChange={e => setSort(SORTS.find(option => option === e.target.value) ?? 'teaching')}
                            aria-label="Sort"
                            className="h-8 px-2 border border-divider rounded-md text-base md:text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                        >
                            {SORTS.map(option => <option key={option} value={option}>{GRAMMAR_SORT_LABEL[option]}</option>)}
                        </select>
                        <div className="flex items-center gap-1.5" role="group" aria-label="Group by">
                            <FilterToggle active={group === 'level'} onClick={() => setGroup('level')}>Level</FilterToggle>
                            <FilterToggle active={group === 'family'} onClick={() => setGroup('family')}>Family</FilterToggle>
                        </div>
                        <FilterToggle active={datasetDetails} onClick={() => setDatasetDetails(d => !d)}>Dataset details</FilterToggle>
                    </div>
                </div>

                {datasetDetails && (
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Dataset filters">
                        {presentKinds.map(kind => (
                            <FilterToggle key={kind} active={kinds.has(kind)} onClick={() => toggle(kinds, kind, setKinds)}>
                                {KIND_LABEL[kind].label}
                            </FilterToggle>
                        ))}
                        {(Object.keys(AXIS_LABEL) as GrammarAxis[]).map(axis => (
                            <FilterToggle key={axis} active={axes.has(axis)} onClick={() => toggle(axes, axis, setAxes)}>
                                {AXIS_LABEL[axis]}
                            </FilterToggle>
                        ))}
                        <FilterToggle active={onlyVariants} onClick={() => setOnlyVariants(v => !v)}>Realization variants</FilterToggle>
                        <FilterToggle active={onlyFamilied} onClick={() => setOnlyFamilied(v => !v)}>In a family</FilterToggle>
                    </div>
                )}

                <p className="type-meta">
                    {filtered.length.toLocaleString('en-US')} points
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery(''); setLevels(new Set()); setStatus('all');
                                setKinds(new Set()); setAxes(new Set()); setOnlyVariants(false); setOnlyFamilied(false);
                            }}
                            className="ml-3 text-accent hover:underline cursor-pointer"
                        >
                            Clear filters
                        </button>
                    )}
                </p>
            </div>

            {groups.length === 0 && (
                <p className="type-support">Nothing matches those filters.</p>
            )}

            <div className="space-y-10">
                {groups.map(g => (
                    <section key={g.key}>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                            <h2 className="type-section">{g.title}</h2>
                            {g.subtitle && <span className="type-meta">{g.subtitle}</span>}
                            {group === 'family' && familiesWithLessons.has(g.key) && (
                                <Link
                                    to={`/grammar/family/${g.key}`}
                                    className="inline-flex items-center gap-1 font-sans text-sm text-accent hover:underline"
                                >
                                    Compare when to use each <ArrowRight size={14} aria-hidden="true" />
                                </Link>
                            )}
                        </div>
                        <div className="flex flex-col">
                            {g.rows.map(row => (
                                <PointRow key={row.id} row={row} progress={progressById.get(row.id)} datasetDetails={datasetDetails} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Page>
    );
}
