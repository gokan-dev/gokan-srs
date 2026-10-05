import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { UserProgress } from "../../../models/user.model";
import type { GrammarTeachingOrder } from "@gokan/dataset-schema";
import { GrammarService } from "../../../services/grammar.service";
import { computeGrammarChapterProgress } from "../../../context/quiz/grammarSelectors";
import { CoverageChart } from "./CoverageChart";

interface GrammarChapterCoverageChartProps {
    progress: UserProgress;
}

const loadOrder = () => GrammarService.loadTeachingOrder();

/**
 * Chapter-axis coverage: the same bars as the JLPT charts, keyed by curriculum chapter.
 * Chapters are the more meaningful axis now that they deliberately mix cross-level
 * register siblings (だが N2 sits in the N5 "But" chapter). There is nothing to fall back
 * to when the teaching order cannot be loaded, since a chapter is authored structure.
 */
export function GrammarChapterCoverageChart({ progress }: GrammarChapterCoverageChartProps) {
    const navigate = useNavigate();
    const rowsOf = useCallback((order: GrammarTeachingOrder) => order.chapters.map((chapter, i) => ({
        key: chapter.id,
        label: `Ch. ${i + 1}`,
        ...computeGrammarChapterProgress(chapter, progress.grammarQueue),
    })), [progress.grammarQueue]);

    return (
        <CoverageChart
            loadKey="grammar-teaching-order"
            load={loadOrder}
            rowsOf={rowsOf}
            unavailableText="Chapter data unavailable."
            itemLabel="chapters"
            headline="Curriculum chapters covered"
            keyColumnLabel="Chapter"
        >
            <button
                onClick={() => void navigate('/grammar/chapters')}
                className="self-start text-xs text-accent font-gothic hover:underline"
            >
                Browse the full curriculum &rarr;
            </button>
        </CoverageChart>
    );
}
