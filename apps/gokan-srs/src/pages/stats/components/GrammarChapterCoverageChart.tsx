import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UserProgress } from "../../../models/user.model";
import type { GrammarTeachingOrder } from "../../../models/grammar.model";
import { GrammarService } from "../../../services/grammar.service";
import { computeGrammarChapterProgress } from "../../../context/quiz/grammarSelectors";
import { JlptCoverageBars, type JlptLevelRow } from "./JlptCoverageBars";

interface GrammarChapterCoverageChartProps {
    progress: UserProgress;
}

/**
 * Chapter-axis coverage (issue #58): the same three-way `JlptCoverageBars`
 * renderer as `GrammarJlptCoverageChart`, but keyed by curriculum chapter
 * instead of JLPT level. Chapters are a more meaningful axis now that they
 * deliberately mix cross-level register siblings (だが N2 sits in the N5
 * "But" chapter) - JLPT level alone increasingly misrepresents what a learner
 * has actually covered.
 *
 * Falls back to nothing (a message) when the teaching order can't be loaded,
 * same failure direction as `GrammarSRSService.getNextCandidates`'s own
 * fallback - there is no "reconstruct chapters from the flat JLPT order"
 * equivalent here, since a chapter is authored structure, not derivable.
 */
export function GrammarChapterCoverageChart({ progress }: GrammarChapterCoverageChartProps) {
    const [order, setOrder] = useState<GrammarTeachingOrder | null>(null);
    const [failed, setFailed] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;

        GrammarService.loadTeachingOrder()
            .then(loaded => {
                if (!mounted) return;
                if (!loaded) setFailed(true);
                else setOrder(loaded);
            })
            .catch(() => { if (mounted) setFailed(true); });

        return () => { mounted = false; };
    }, []);

    const rows = useMemo<JlptLevelRow[]>(() => {
        if (!order) return [];

        return order.chapters.map((chapter, i) => {
            const counts = computeGrammarChapterProgress(chapter, progress.grammarQueue);
            return {
                key: chapter.id,
                label: `Ch. ${i + 1}`,
                mastered: counts.mastered,
                learning: counts.learning,
                total: counts.total,
            };
        });
    }, [order, progress.grammarQueue]);

    if (failed) {
        return <p className="text-sm text-tertiary">Chapter data unavailable.</p>;
    }

    if (!order) {
        return <div className="h-40 animate-pulse rounded bg-surface-hover/40" />;
    }

    return (
        <div className="flex flex-col gap-2">
            <JlptCoverageBars
                rows={rows}
                itemLabel="chapters"
                headline="Curriculum chapters covered"
                keyColumnLabel="Chapter"
            />
            <button
                onClick={() => navigate('/grammar/chapters')}
                className="self-start text-xs text-accent font-gothic hover:underline"
            >
                Browse the full curriculum &rarr;
            </button>
        </div>
    );
}
