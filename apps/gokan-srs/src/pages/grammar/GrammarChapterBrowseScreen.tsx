import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { GrammarBrowseIndex, GrammarBrowseRow, GrammarTeachingOrder } from "@gokan/dataset-schema";
import { GrammarService } from "../../services/grammar.service";
import { useQuiz } from "../../context/useQuiz";
import { ChapterProgressBar } from "../../components/ChapterProgressBar";
import { computeGrammarChapterProgress } from "../../context/quiz/grammarSelectors";
import { Page } from "../../components/Page";
import { StatusDot } from "../../components/StatusDot";
import { ListRow } from "../../components/ui/ListRow";
import { grammarLearningStatus } from "../../utils/learningStatus.utils";
import { groupChaptersByLevel } from "../../utils/chapterProgress.utils";
import { GrammarHomeHeader } from "./GrammarHomeHeader";

/**
 * Route /grammar/chapters, the Grammar home's Curriculum tab (issue #58): every
 * chapter of the authored teaching order under level headings, each expandable
 * to its points.
 *
 * It opens on the learner's current chapter (the same one the hub's grammar
 * card names), expanded and scrolled into view; `?chapter=<id>` (from a grammar
 * point's locator, or a direct link) overrides it.
 *
 * A chapter's progress bar reuses `computeGrammarChapterProgress` /
 * `ChapterProgressBar`, the same pair the hub's grammar card uses: one
 * definition of "how much of this chapter is done" everywhere it is shown.
 */
export function GrammarChapterBrowseScreen() {
    const { state, grammarHubChapter } = useQuiz();
    const [searchParams] = useSearchParams();
    const [order, setOrder] = useState<GrammarTeachingOrder | null>(null);
    const [browseIndex, setBrowseIndex] = useState<GrammarBrowseIndex | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const chapterRefs = useRef(new Map<string, HTMLElement>());
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

    const currentChapterId = grammarHubChapter && grammarHubChapter.status !== 'complete' ? grammarHubChapter.chapterId : null;
    const targetChapterId = searchParams.get('chapter') ?? currentChapterId;

    // Expand the target once loaded and scroll it into view. Applied once per
    // mount (`scrolledToTarget`), so it never fights the learner's own expand and
    // collapse afterwards. The ref sits on the chapter's outer element, which is
    // always rendered, so scrolling works before the expand re-render lands.
    useEffect(() => {
        if (!order || !targetChapterId || scrolledToTarget.current) return;
        if (!order.chapters.some(c => c.id === targetChapterId)) return;
        scrolledToTarget.current = true;
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

    const levelGroups = useMemo(() => {
        if (!order) return [];
        const q = query.trim().toLowerCase();
        return groupChaptersByLevel(order.chapters)
            .map(group => ({
                ...group,
                chapters: q
                    ? group.chapters.filter(({ chapter }) =>
                        chapter.title.toLowerCase().includes(q) || chapter.summary.toLowerCase().includes(q))
                    : group.chapters,
            }))
            .filter(group => group.chapters.length > 0);
    }, [order, query]);

    if (failed) {
        return (
            <Page width="wide">
                <GrammarHomeHeader stats={null} />
                <p className="type-support">Could not load the grammar curriculum.</p>
            </Page>
        );
    }

    if (!order || !browseIndex) {
        return (
            <Page width="wide">
                <GrammarHomeHeader stats={null} />
                <p className="type-support">Loading the curriculum...</p>
            </Page>
        );
    }

    return (
        <Page width="wide">
            <GrammarHomeHeader stats={browseIndex.stats} />

            <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search chapter title or summary"
                aria-label="Search chapters"
                className="w-full bg-surface border border-divider rounded-md px-3 py-2 text-base md:text-sm font-sans text-primary placeholder:text-input-placeholder outline-none focus:border-accent mb-8"
            />

            {levelGroups.length === 0 && (
                <p className="type-support">No chapters match that search.</p>
            )}

            <div className="space-y-10">
                {levelGroups.map((group, groupIndex) => (
                    <section key={`${group.level}-${groupIndex}`}>
                        <h2 className="type-section mb-4">N{group.level}</h2>
                        <div className="flex flex-col divide-y divide-divider border-y border-divider">
                            {group.chapters.map(({ chapter, number }) => {
                                const isOpen = expanded.has(chapter.id);
                                const isCurrent = chapter.id === currentChapterId;
                                const counts = computeGrammarChapterProgress(chapter, grammarQueue);

                                return (
                                    <div
                                        key={chapter.id}
                                        ref={el => { if (el) chapterRefs.current.set(chapter.id, el); }}
                                        className="scroll-mt-4"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleExpanded(chapter.id)}
                                            aria-expanded={isOpen}
                                            className="w-full text-left py-4 px-2 flex items-start gap-3 rounded-md hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="type-meta">Chapter {number}</span>
                                                    {isCurrent && (
                                                        <span className="rounded-md border border-accent text-accent font-sans text-xs px-1.5 py-0.5">
                                                            Current
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="type-subsection mt-0.5">{chapter.title}</h3>
                                                <p className="type-support line-clamp-2 mt-0.5">{chapter.summary}</p>
                                                <div className="mt-2 max-w-md">
                                                    <ChapterProgressBar counts={counts} />
                                                </div>
                                            </div>
                                            <ChevronDown
                                                size={16}
                                                aria-hidden="true"
                                                className={`mt-1 shrink-0 text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {isOpen && (
                                            <div className="pb-3 grid gap-1 sm:grid-cols-2">
                                                {chapter.points.map(id => (
                                                    <ListRow key={id} to={`/grammar/${id}`} className="py-1.5">
                                                        <span className="flex items-center gap-2 min-w-0">
                                                            <StatusDot
                                                                status={grammarLearningStatus(grammarQueue.find(item => item.grammarId === id))}
                                                                label={null}
                                                            />
                                                            <span className="font-mincho text-base text-primary truncate">
                                                                {rowById.get(id)?.title ?? id}
                                                            </span>
                                                        </span>
                                                    </ListRow>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </Page>
    );
}
