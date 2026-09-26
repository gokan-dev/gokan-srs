import { useEffect, useMemo, useState } from "react";
import { usePersistControls, usePersistedControlsSnapshot } from "../../hooks/usePersistedControls";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { GrammarAxis, GrammarBrowseIndex, GrammarBrowseRow, GrammarPoint } from "../../models/grammar.model";
import { GrammarService } from "../../services/grammar.service";
import { JlptChip } from "../../components/JlptChip";

type Kind = NonNullable<GrammarPoint['kind']>;
type GroupMode = 'level' | 'family';

/**
 * Which exercise a point is drilled by, colour-coded. This is the primary
 * colour axis on the page because it is the one thing that decides whether a
 * point is teachable at all.
 */
const KIND_STYLE: Record<Kind, { label: string; quiz: string; text: string; bg: string; border: string }> = {
    'construction': {
        label: 'Construction',
        quiz: 'Sentence cloze',
        text: 'text-quiz-cloze', bg: 'bg-quiz-cloze-soft', border: 'border-quiz-cloze',
    },
    'inflection': {
        label: 'Inflection',
        quiz: 'Conjugation drill',
        text: 'text-quiz-conjugation', bg: 'bg-quiz-conjugation-soft', border: 'border-quiz-conjugation',
    },
    'lexical': {
        label: 'Lexical',
        quiz: 'Sentence cloze',
        text: 'text-quiz-lexical', bg: 'bg-quiz-lexical-soft', border: 'border-quiz-lexical',
    },
};

/** What differentiates a family's members, which decides how they are taught. */
const AXIS_LABEL: Record<GrammarAxis, { label: string; hint: string }> = {
    'register': { label: 'Register ladder', hint: 'Same meaning, different formality. Taught together, across JLPT levels.' },
    'constraint': { label: 'Constraint', hint: 'Adds a semantic restriction that can be got wrong. Stays level-gated.' },
    'variant': { label: 'Interchangeable', hint: 'No differentiator exists. A recognition set, not separate items.' },
};

const FORMALITY_LABEL: Record<string, string> = {
    'casual': 'Casual', 'neutral': 'Neutral', 'polite': 'Polite',
    'formal': 'Formal', 'very-formal-literary': 'Literary',
};

const LEVELS = [5, 4, 3, 2, 1];

// Mirrors SmartVocabList/SmartGrammarList's own keys, under one of its own.
const BROWSE_STATE_KEY = 'gokan_grammar_browse_state';

/**
 * Sets are stored as arrays: JSON.stringify turns a Set into `{}`, which would silently persist
 * every multi-select filter as empty and look like the filters simply were not kept.
 */
interface PersistedBrowseState {
    query: string;
    levels: number[];
    kinds: Kind[];
    axes: GrammarAxis[];
    onlyVariants: boolean;
    onlyFamilied: boolean;
    group: GroupMode;
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={`text-[11px] font-gothic rounded px-1.5 py-0.5 border whitespace-nowrap ${className}`}>
            {children}
        </span>
    );
}

function Toggle({ active, onClick, children, accent }: { active: boolean; onClick: () => void; children: React.ReactNode; accent?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-xs font-gothic rounded px-2 py-1 border transition-colors ${active
                ? `${accent ?? 'bg-accent border-accent text-surface'}`
                : 'border-divider text-secondary hover:bg-surface-hover'}`}
        >
            {children}
        </button>
    );
}

function PointCard({ row }: { row: GrammarBrowseRow }) {
    const style = KIND_STYLE[row.kind] ?? KIND_STYLE.construction;
    const isVariant = !!row.variantOf;

    return (
        <Link
            to={`/grammar/${row.id}`}
            className={`block min-w-0 rounded-lg border bg-surface p-3 transition-colors hover:bg-surface-hover ${isVariant ? 'border-dashed border-divider' : 'border-divider'}`}
        >
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                    <p className="font-mincho text-primary text-lg leading-snug truncate">{row.title}</p>
                    {row.romaji && <p className="font-gothic text-tertiary text-xs truncate">{row.romaji}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <JlptChip level={row.jlptLevel} />
                    <span className="text-[11px] font-gothic text-tertiary">{row.id}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
                <Chip className={`${style.bg} ${style.text} ${style.border}`}>{style.quiz}</Chip>
                {row.derives && <Chip className={`${style.bg} ${style.text} ${style.border}`}>{row.derives}</Chip>}
                {row.formalityLevel && (
                    <Chip className="border-divider text-secondary">{FORMALITY_LABEL[row.formalityLevel] ?? row.formalityLevel}</Chip>
                )}
                {row.axis && <Chip className="border-divider text-secondary">{AXIS_LABEL[row.axis].label}</Chip>}
                {isVariant && (
                    <Chip className="border-divider text-tertiary">
                        {row.variantRelation} of {row.variantOf}
                    </Chip>
                )}
                {row.orderIndex === null && !isVariant && (
                    <Chip className="border-error text-error">Not introduced</Chip>
                )}
            </div>

            <p className="font-serif text-sm text-meaning-muted leading-snug mb-2">{row.shortExplanation}</p>

            <p className="font-gothic text-xs text-tertiary truncate mb-1" title={row.formation}>{row.formation}</p>

            {row.usageNote && (
                <p className="font-serif text-xs text-secondary italic leading-snug mb-1">{row.usageNote}</p>
            )}

            <div className="flex flex-wrap gap-x-3 text-[11px] font-gothic text-tertiary">
                {row.orderIndex !== null && <span>#{row.orderIndex + 1} in order</span>}
                {row.chapterTitle && <span className="truncate">{row.chapterTitle}</span>}
                <span>
                    {row.anchoredExampleCount}/{row.exampleCount} anchored
                </span>
                {row.conjugationItems !== undefined && <span>{row.conjugationItems} drill items</span>}
            </div>
        </Link>
    );
}

/**
 * A read-only view of the whole grammar dataset: every point as a card, grouped
 * by JLPT level in introduction order or by near-synonym family, with search and
 * filters.
 *
 * Its purpose is inspection rather than study. The numbers that used to be
 * reported in prose (how many points are construction vs inflection, which
 * families are register ladders, what is excluded from the order and why) are
 * visible here instead.
 */
export function GrammarBrowseScreen() {
    const [index, setIndex] = useState<GrammarBrowseIndex | null>(null);
    const [failed, setFailed] = useState(false);
    // Families that have at least one authored contrast lesson, so the
    // family-grouped view can link out to the page comparing them - the browse
    // screen's family grouping is the closest thing this app has to a family
    // index, so it is where a "which families have lessons" entry point fits.
    const [familiesWithLessons, setFamiliesWithLessons] = useState<Set<string>>(new Set());

    const persisted = usePersistedControlsSnapshot<PersistedBrowseState>(BROWSE_STATE_KEY);

    const [query, setQuery] = useState(persisted.query ?? '');
    const [levels, setLevels] = useState<Set<number>>(() => new Set(persisted.levels ?? []));
    const [kinds, setKinds] = useState<Set<Kind>>(() => new Set(persisted.kinds ?? []));
    const [axes, setAxes] = useState<Set<GrammarAxis>>(() => new Set(persisted.axes ?? []));
    const [onlyVariants, setOnlyVariants] = useState(persisted.onlyVariants ?? false);
    const [onlyFamilied, setOnlyFamilied] = useState(persisted.onlyFamilied ?? false);
    // Family, not level: the page's reason to exist is comparing near-synonyms, and the level
    // ordering is already what every other grammar surface (the browse index, the SRS queue)
    // presents. Grouping by family is the view you cannot get anywhere else.
    const [group, setGroup] = useState<GroupMode>(persisted.group ?? 'family');

    usePersistControls<PersistedBrowseState>(
        BROWSE_STATE_KEY,
        {
            query,
            levels: [...levels],
            kinds: [...kinds],
            axes: [...axes],
            onlyVariants,
            onlyFamilied,
            group,
        },
        [query, levels, kinds, axes, onlyVariants, onlyFamilied, group],
    );

    useEffect(() => {
        GrammarService.loadBrowseIndex().then(loaded => {
            if (loaded) setIndex(loaded); else setFailed(true);
        });
    }, []);

    useEffect(() => {
        GrammarService.loadContrasts().then(contrasts => {
            const withLessons = new Set(
                Object.entries(contrasts)
                    .filter(([, entry]) => entry.lessons.length > 0)
                    .map(([familyId]) => familyId)
            );
            setFamiliesWithLessons(withLessons);
        });
    }, []);

    const toggle = <T,>(set: Set<T>, value: T, apply: (next: Set<T>) => void) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        apply(next);
    };

    const filtered = useMemo(() => {
        if (!index) return [];
        const q = query.trim().toLowerCase();
        return index.points.filter(row => {
            if (levels.size > 0 && !levels.has(row.jlptLevel)) return false;
            if (kinds.size > 0 && !kinds.has(row.kind)) return false;
            if (axes.size > 0 && (!row.axis || !axes.has(row.axis))) return false;
            if (onlyVariants && !row.variantOf) return false;
            if (onlyFamilied && !row.familyId) return false;
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
    }, [index, query, levels, kinds, axes, onlyVariants, onlyFamilied]);

    /**
     * Groups are always ordered so the heading order means something: by level
     * the rows keep their introduction order, and by family the biggest families
     * come first because they are the ones worth inspecting.
     */
    const groups = useMemo(() => {
        if (group === 'level') {
            return LEVELS
                .map(level => ({
                    key: `N${level}`,
                    title: `N${level}`,
                    subtitle: 'introduction order',
                    rows: filtered.filter(r => r.jlptLevel === level),
                }))
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
            .map(([id, rows]) => {
                const variants = rows.filter(r => r.variantOf).length;
                const axisMix = [...new Set(rows.map(r => r.axis).filter(Boolean))] as GrammarAxis[];
                const spread = new Set(rows.map(r => r.jlptLevel)).size;
                return {
                    key: id,
                    title: rows[0].familyName ?? id,
                    subtitle: [
                        `${rows.length} member${rows.length > 1 ? 's' : ''}`,
                        spread > 1 ? `spans ${spread} levels` : null,
                        // The boundary that decides how the family is taught.
                        variants > 0 ? `${variants} realization variant${variants > 1 ? 's' : ''}` : 'lexical alternatives',
                        ...axisMix.map(a => AXIS_LABEL[a].label.toLowerCase()),
                    ].filter(Boolean).join(' · '),
                    rows,
                };
            })
            .sort((a, b) => b.rows.length - a.rows.length || a.title.localeCompare(b.title));

        if (unfamilied.length > 0) {
            familyGroups.push({
                key: '__none__',
                title: 'No family',
                subtitle: `${unfamilied.length} points with no near-synonym cluster`,
                rows: unfamilied,
            });
        }
        return familyGroups;
    }, [filtered, group]);

    if (failed) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 py-8">
                <p className="text-secondary font-gothic">Could not load the grammar index.</p>
            </div>
        );
    }
    if (!index) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 py-8">
                <p className="text-secondary font-gothic">Loading grammar dataset...</p>
            </div>
        );
    }

    const { stats } = index;

    /*
     * Only the kinds that actually have points. `lexical` currently reads 0 -
     * gokan-dev/gokan-dataset#15 closed without populating it, on the measured
     * finding that the 20 genuinely lexical points work correctly as
     * constructions. A tile reading 0 is noise, and the filter toggle was worse
     * than noise: selecting it filtered every row out, which reads as a bug
     * rather than as an empty category.
     *
     * Derived rather than deleted, so the day a kind IS populated its tile and
     * filter come back on their own - and so this never has to be revisited for
     * whatever the next kind turns out to be.
     */
    const presentKinds = (Object.keys(KIND_STYLE) as Kind[]).filter(kind => (stats.byKind[kind] ?? 0) > 0);

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-6">
            <Link to="/grammar" className="text-accent font-gothic text-sm hover:underline">
                <ArrowLeft className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Back
            </Link>

            <h1 className="font-serif text-2xl text-primary mt-3 mb-1">Grammar dataset</h1>
            <p className="font-gothic text-sm text-secondary mb-4">
                {stats.points} points, {stats.introduced} introduced, {stats.chapters} chapters
            </p>

            {/* Coverage at a glance: what exists, what is taught, what is not. */}
            {/*
              * flex-wrap rather than a fixed column count: the number of tiles
              * depends on how many kinds are populated, and a fixed grid left a
              * trailing empty cell whenever that was not exactly six.
              */}
            <div className="flex flex-wrap gap-2 mb-6">
                {presentKinds.map(kind => (
                    <div key={kind} className={`flex-1 min-w-[132px] rounded-lg border p-2 ${KIND_STYLE[kind].bg} ${KIND_STYLE[kind].border}`}>
                        <p className={`font-serif text-xl ${KIND_STYLE[kind].text}`}>{stats.byKind[kind] ?? 0}</p>
                        <p className="font-gothic text-[11px] text-secondary">{KIND_STYLE[kind].label}</p>
                        <p className="font-gothic text-[11px] text-tertiary">{KIND_STYLE[kind].quiz}</p>
                    </div>
                ))}
                <div className="flex-1 min-w-[132px] rounded-lg border border-divider p-2">
                    <p className="font-serif text-xl text-primary">{stats.families}</p>
                    <p className="font-gothic text-[11px] text-secondary">Families</p>
                    <p className="font-gothic text-[11px] text-tertiary">{stats.unfamilied} unfamilied</p>
                </div>
                <div className="flex-1 min-w-[132px] rounded-lg border border-divider p-2">
                    <p className="font-serif text-xl text-primary">{stats.variantGroups}</p>
                    <p className="font-gothic text-[11px] text-secondary">Variant groups</p>
                    <p className="font-gothic text-[11px] text-tertiary">{stats.variants} not introduced</p>
                </div>
                <div className="flex-1 min-w-[132px] rounded-lg border border-divider p-2">
                    <p className="font-serif text-xl text-primary">
                        {(stats.byAxis.register ?? 0)}/{(stats.byAxis.constraint ?? 0)}/{(stats.byAxis.variant ?? 0)}
                    </p>
                    <p className="font-gothic text-[11px] text-secondary">Register / constraint / variant</p>
                </div>
            </div>

            {/* Controls */}
            <div className="rounded-lg border border-divider bg-feedback-background p-3 mb-6 space-y-3">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search title, romaji, id, explanation, usage note, family, formation"
                    className="w-full bg-surface border border-divider rounded px-3 py-2 text-sm font-gothic text-primary placeholder:text-input-placeholder outline-none focus:border-accent"
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="font-gothic text-[11px] text-label-neutral uppercase tracking-wide mr-1">Level</span>
                        {LEVELS.map(level => (
                            <Toggle key={level} active={levels.has(level)} onClick={() => toggle(levels, level, setLevels)}>
                                N{level}
                            </Toggle>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="font-gothic text-[11px] text-label-neutral uppercase tracking-wide mr-1">Quiz</span>
                        {presentKinds.map(kind => (
                            <Toggle
                                key={kind}
                                active={kinds.has(kind)}
                                onClick={() => toggle(kinds, kind, setKinds)}
                                accent={`${KIND_STYLE[kind].bg} ${KIND_STYLE[kind].border} ${KIND_STYLE[kind].text}`}
                            >
                                {KIND_STYLE[kind].label}
                            </Toggle>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="font-gothic text-[11px] text-label-neutral uppercase tracking-wide mr-1">Family</span>
                        {(Object.keys(AXIS_LABEL) as GrammarAxis[]).map(axis => (
                            <Toggle key={axis} active={axes.has(axis)} onClick={() => toggle(axes, axis, setAxes)}>
                                {AXIS_LABEL[axis].label}
                            </Toggle>
                        ))}
                        <Toggle active={onlyVariants} onClick={() => setOnlyVariants(v => !v)}>Realization variants</Toggle>
                        <Toggle active={onlyFamilied} onClick={() => setOnlyFamilied(v => !v)}>In a family</Toggle>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="font-gothic text-[11px] text-label-neutral uppercase tracking-wide mr-1">Group</span>
                        <Toggle active={group === 'level'} onClick={() => setGroup('level')}>JLPT level</Toggle>
                        <Toggle active={group === 'family'} onClick={() => setGroup('family')}>Family</Toggle>
                    </div>
                </div>

                <p className="font-gothic text-xs text-tertiary">
                    {filtered.length} of {stats.points} points
                    {(levels.size || kinds.size || axes.size || onlyVariants || onlyFamilied || query) ? (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setLevels(new Set()); setKinds(new Set()); setAxes(new Set()); setOnlyVariants(false); setOnlyFamilied(false); }}
                            className="ml-2 text-accent hover:underline"
                        >
                            Clear filters
                        </button>
                    ) : null}
                </p>
            </div>

            {groups.length === 0 && (
                <p className="font-gothic text-sm text-secondary">Nothing matches those filters.</p>
            )}

            {groups.map(g => (
                <section key={g.key} className="mb-8">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-divider pb-1 mb-3">
                        <h2 className="font-serif text-lg text-primary">{g.title}</h2>
                        <span className="font-gothic text-xs text-tertiary">{g.subtitle}</span>
                        {group === 'family' && familiesWithLessons.has(g.key) && (
                            <Link
                                to={`/grammar/family/${g.key}`}
                                className="inline-flex items-center gap-1 text-xs font-gothic text-accent hover:underline"
                            >
                                Compare when to use each <ArrowRight size={12} />
                            </Link>
                        )}
                        <span className="font-gothic text-xs text-tertiary ml-auto">{g.rows.length}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {g.rows.map(row => <PointCard key={row.id} row={row} />)}
                    </div>
                </section>
            ))}
        </div>
    );
}
