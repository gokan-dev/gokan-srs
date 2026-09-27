import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import type { GrammarBrowseIndex, GrammarBrowseRow, GrammarTeachingOrder } from "../../models/grammar.model";
import { GrammarService } from "../../services/grammar.service";
import { isGrammarFullyMastered } from "../../services/grammarScheduling";
import { useQuiz } from "../../context/useQuiz";
import { JlptChip } from "../../components/JlptChip";
import { ChapterProgressBar } from "../../components/ChapterProgressBar";
import { computeGrammarChapterProgress } from "../../context/quiz/grammarSelectors";

type PointStatus = 'mastered' | 'learning' | 'untouched';

const STATUS_DOT: Record<PointStatus, string> = {
    mastered: 'bg-accent',
    learning: 'bg-accent opacity-35',
    untouched: 'bg-surface-hover border border-divider',
};

/**
 * Route /grammar/chapters (issue #58): every chapter of the authored teaching
 * order, in order, each expandable to its member points. This is the
 * curriculum a learner might reasonably want to see in full - 151 chapters is
 * too many to browse any other way, and the existing `/grammar/browse` page
 * groups by JLPT level or family, neither of which is "the order I will
 * actually meet these in".
 *
 * A chapter's own three-way progress bar reuses `computeGrammarChapterProgress`
 * / `ChapterProgressBar`, the same pair the Main hub's grammar card and the
 * Stats chapter-coverage chart use - one definition of "how much of this
 * chapter is done" everywhere it is shown.
 *
 * `?chapter=<id>` (from `GrammarDetailScreen`'s locator, or a direct link)
 * auto-expands and scrolls to that one chapter on load.
 */
export function GrammarChapterBrowseScreen() {
    const { state } = useQuiz();
    const [searchParams] = useSearchParams();
    const [order, setOrder] = useState<GrammarTeachingOrder | null>(null);
    const [browseIndex, setBrowseIndex] = useState<GrammarBrowseIndex | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const chapterRefs = useRef(new Map<string, HTMLDivElement>());
    const scrolledToTarget = useRef(false);

    useEffect(() => {
        Promise.all([GrammarService.loadTeachingOrder(), GrammarService.loadBrowseIndex()])
            .then(([loadedOrder, loadedBrowse]) => {
                if (!loadedOrder || !loadedBrowse) { setFailed(true); return; }
                setOrder(loadedOrder);
                setBrowseIndex(loadedBrowse);
            })
            .catch(() => setFailed(true));
    }, []);

    const rowById = useMemo(() => {
        const map = new Map<string, GrammarBrowseRow>();
        if (browseIndex) for (const row of browseIndex.points) map.set(row.id, row);
        return map;
    }, [browseIndex]);

    const grammarQueue = state.progress?.grammarQueue ?? [];

    const pointStatus = (id: string): PointStatus => {
        const g = grammarQueue.find(item => item.grammarId === id);
        if (!g || !g.introductionAt) return 'untouched';
        return isGrammarFullyMastered(g) ? 'mastered' : 'learning';
    };

    // Deep-link target: expand it once loaded and scroll it into view. Only
    // ever applied once per mount (`scrolledToTarget`), so re-navigating with
    // the same param while already on the page (e.g. clicking the same link
    // twice) never fights the user's own manual expand/collapse afterward.
    const targetChapterId = searchParams.get('chapter');
    useEffect(() => {
        if (!order || !targetChapterId || scrolledToTarget.current) return;
        if (!order.chapters.some(c => c.id === targetChapterId)) return;
        scrolledToTarget.current = true;
        // Both the expand and the scroll happen inside the animation-frame
        // callback rather than synchronously in the effect body (the lint
        // rule against that exists because it can cascade renders). Scrolling
        // works immediately even before the expand re-render lands, since the
        // ref sits on the chapter's outer container, which is always rendered
        // - only the point list inside it is conditional on `isOpen`.
        requestAnimationFrame(() => {
            setExpanded(prev => new Set(prev).add(targetChapterId));
            chapterRefs.current.get(targetChapterId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [order, targetChapterId]);

    const toggleExpanded = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const filteredChapters = useMemo(() => {
        if (!order) return [];
        const q = query.trim().toLowerCase();
        if (!q) return order.chapters;
        return order.chapters.filter(chapter =>
            chapter.title.toLowerCase().includes(q)
            || chapter.summary.toLowerCase().includes(q)
            || chapter.id.toLowerCase().includes(q)
        );
    }, [order, query]);

    if (failed) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 py-8">
                <p className="text-secondary font-gothic">Could not load the grammar curriculum.</p>
            </div>
        );
    }

    if (!order || !browseIndex) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 py-8">
                <p className="text-secondary font-gothic">Loading curriculum...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6">
            <Link to="/grammar" className="text-accent font-gothic text-sm hover:underline">
                <ArrowLeft className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Back
            </Link>

            <h1 className="font-serif text-2xl text-primary mt-3 mb-1">Grammar curriculum</h1>
            <p className="font-gothic text-sm text-secondary mb-4">
                {order.chapters.length} chapters, {order.order.length} points, in teaching order
            </p>

            <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search chapter title or summary"
                className="w-full bg-surface border border-divider rounded px-3 py-2 text-sm font-gothic text-primary placeholder:text-input-placeholder outline-none focus:border-accent mb-6"
            />

            {filteredChapters.length === 0 && (
                <p className="font-gothic text-sm text-secondary">No chapters match that search.</p>
            )}

            <div className="flex flex-col gap-2">
                {filteredChapters.map(chapter => {
                    const index = order.chapters.indexOf(chapter);
                    const isOpen = expanded.has(chapter.id);
                    const counts = computeGrammarChapterProgress(chapter, grammarQueue);

                    return (
                        <div
                            key={chapter.id}
                            ref={el => { if (el) chapterRefs.current.set(chapter.id, el); }}
                            className={`rounded-lg border bg-surface transition-colors ${chapter.id === targetChapterId ? 'border-accent' : 'border-divider'}`}
                        >
                            <button
                                type="button"
                                onClick={() => toggleExpanded(chapter.id)}
                                className="w-full text-left p-3 flex items-start gap-3"
                            >
                                {isOpen
                                    ? <ChevronDown size={16} className="mt-1 shrink-0 text-tertiary" />
                                    : <ChevronRight size={16} className="mt-1 shrink-0 text-tertiary" />}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="font-gothic text-xs text-tertiary">Chapter {index + 1}</span>
                                        <JlptChip level={chapter.jlptLevel} />
                                        <h2 className="font-serif text-base text-primary truncate">{chapter.title}</h2>
                                    </div>
                                    <p className="font-serif text-sm text-secondary leading-snug mt-0.5">
                                        {chapter.summary}
                                    </p>
                                    <div className="mt-2 max-w-sm">
                                        <ChapterProgressBar counts={counts} />
                                    </div>
                                </div>
                            </button>

                            {isOpen && (
                                <div className="border-t border-divider p-3 grid gap-1.5 sm:grid-cols-2">
                                    {chapter.points.map(id => {
                                        const row = rowById.get(id);
                                        const status = pointStatus(id);
                                        return (
                                            <Link
                                                key={id}
                                                to={`/grammar/${id}`}
                                                className="flex items-center gap-2 min-w-0 rounded px-2 py-1.5 hover:bg-surface-hover transition-colors"
                                            >
                                                <span
                                                    className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`}
                                                    aria-hidden="true"
                                                    title={status}
                                                />
                                                <span className="font-mincho text-sm text-primary truncate">
                                                    {row?.title ?? id}
                                                </span>
                                                {row && <JlptChip level={row.jlptLevel} />}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
