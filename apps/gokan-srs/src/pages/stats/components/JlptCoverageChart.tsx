import { useCallback } from "react";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import { JLPT_LEVELS, type JlptIndex } from "@gokan/dataset-schema";
import { VocabularyService } from "../../../services/vocabulary.service";
import { isVocabFullyMastered } from "../../../services/scheduling";
import { coverageOf, statusIndex } from "../../../utils/coverage.utils";
import { CoverageChart } from "./CoverageChart";

interface JlptCoverageChartProps {
    progress: UserProgress;
    settings?: UserSettings;
}

const loadIndex = () => VocabularyService.loadJlptIndex();

/**
 * Per-JLPT-level coverage of the official vocabulary lists: how much of each level the
 * user has started, split into still-in-progress and fully mastered.
 */
export function JlptCoverageChart({ progress, settings }: JlptCoverageChartProps) {
    const rowsOf = useCallback((index: JlptIndex) => {
        const status = statusIndex(progress.learningQueue, v => v.vocabId, v => (isVocabFullyMastered(v, settings) ? 'mastered' : 'learning'));
        return JLPT_LEVELS.map(level => ({
            key: level,
            label: `N${level}`,
            ...coverageOf((index[level] ?? []).map(entry => entry.id), status),
        }));
    }, [progress.learningQueue, settings]);

    return (
        <CoverageChart
            loadKey="vocab-jlpt-index"
            load={loadIndex}
            rowsOf={rowsOf}
            unavailableText="JLPT data unavailable."
            itemLabel="vocabulary"
            headline="JLPT vocabulary covered"
        />
    );
}
