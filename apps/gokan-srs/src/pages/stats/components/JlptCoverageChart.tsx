import { useEffect, useMemo, useState } from "react";
import type { UserProgress, UserSettings } from "../../../models/user.model";
import type { JlptIndex } from "@gokan/dataset-schema";
import { JLPT_LEVELS } from "@gokan/dataset-schema";
import { VocabularyService } from "../../../services/vocabulary.service";
import { isVocabFullyMastered } from "../../../services/scheduling";
import { JlptCoverageBars, type JlptLevelRow } from "./JlptCoverageBars";

interface JlptCoverageChartProps {
    progress: UserProgress;
    settings?: UserSettings;
}

/**
 * Per-JLPT-level coverage: how much of each official level's vocabulary the user
 * has started, split into still-in-progress and fully mastered. Rendering is
 * shared with the grammar equivalent (`GrammarJlptCoverageChart`) via
 * `JlptCoverageBars` - this component only computes `rows` from the vocab-shaped
 * data (learningQueue + index/jlpt.json).
 */
export function JlptCoverageChart({ progress, settings }: JlptCoverageChartProps) {
    const [index, setIndex] = useState<JlptIndex | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let mounted = true;

        VocabularyService.loadJlptIndex()
            .then(idx => { if (mounted) setIndex(idx); })
            .catch(() => { if (mounted) setFailed(true); });

        return () => { mounted = false; };
    }, []);

    const rows = useMemo<JlptLevelRow[]>(() => {
        if (!index) return [];

        // Split the queue once, then test membership per level - the alternative
        // (scanning the queue inside each level) is 5 passes over a queue that
        // can hold thousands of items.
        const masteredIds = new Set<string>();
        const learningIds = new Set<string>();
        for (const vocab of progress.learningQueue || []) {
            if (isVocabFullyMastered(vocab, settings)) masteredIds.add(vocab.vocabId);
            else learningIds.add(vocab.vocabId);
        }

        return JLPT_LEVELS.map(level => {
            const entries = index[level] ?? [];
            let mastered = 0;
            let learning = 0;

            for (const entry of entries) {
                if (masteredIds.has(entry.id)) mastered++;
                else if (learningIds.has(entry.id)) learning++;
            }

            return { key: level, label: `N${level}`, mastered, learning, total: entries.length };
        });
    }, [index, progress.learningQueue, settings]);

    if (failed) {
        return <p className="text-sm text-tertiary">JLPT data unavailable.</p>;
    }

    if (!index) {
        return <div className="h-40 animate-pulse rounded bg-surface-hover/40" />;
    }

    return <JlptCoverageBars rows={rows} itemLabel="vocabulary" headline="JLPT vocabulary covered" />;
}
