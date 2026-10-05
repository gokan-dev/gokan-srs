import { useCallback } from "react";
import type { UserProgress } from "../../../models/user.model";
import { JLPT_LEVELS, type GrammarJlptIndex } from "@gokan/dataset-schema";
import { GrammarService } from "../../../services/grammar.service";
import { isGrammarFullyMastered } from "../../../services/grammarScheduling";
import { coverageOf, statusIndex } from "../../../utils/coverage.utils";
import { CoverageChart } from "./CoverageChart";

interface GrammarJlptCoverageChartProps {
    progress: UserProgress;
}

const loadIndex = () => GrammarService.loadJlptIndex();

/** Grammar's equivalent of JlptCoverageChart, counted against `grammar/index/jlpt.json`. */
export function GrammarJlptCoverageChart({ progress }: GrammarJlptCoverageChartProps) {
    const rowsOf = useCallback((index: GrammarJlptIndex) => {
        const status = statusIndex(progress.grammarQueue, g => g.grammarId, g => (isGrammarFullyMastered(g) ? 'mastered' : 'learning'));
        return JLPT_LEVELS.map(level => ({ key: level, label: `N${level}`, ...coverageOf(index[level] ?? [], status) }));
    }, [progress.grammarQueue]);

    return (
        <CoverageChart
            loadKey="grammar-jlpt-index"
            load={loadIndex}
            rowsOf={rowsOf}
            unavailableText="Grammar JLPT data unavailable."
            itemLabel="grammar points"
            headline="JLPT grammar points covered"
        />
    );
}
