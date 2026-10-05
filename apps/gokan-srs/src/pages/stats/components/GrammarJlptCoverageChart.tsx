import { useEffect, useMemo, useState } from "react";
import type { UserProgress } from "../../../models/user.model";
import type { GrammarJlptIndex } from "@gokan/dataset-schema";
import { GRAMMAR_JLPT_LEVELS } from "@gokan/dataset-schema";
import { GrammarService } from "../../../services/grammar.service";
import { isGrammarFullyMastered } from "../../../services/grammarScheduling";
import { JlptCoverageBars, type JlptLevelRow } from "./JlptCoverageBars";

interface GrammarJlptCoverageChartProps {
    progress: UserProgress;
}

/**
 * Grammar's equivalent of `JlptCoverageChart` - same `JlptCoverageBars`
 * renderer, driven by `grammarQueue` + `grammar/index/jlpt.json` instead of
 * `learningQueue` + `index/jlpt.json`. Kept as a separate component rather than
 * folded into the vocab chart since the underlying index shape (no
 * `containedKanji`) and mastery predicate (`isGrammarFullyMastered`, no
 * settings) genuinely differ - only the bar/legend/table rendering is shared.
 */
export function GrammarJlptCoverageChart({ progress }: GrammarJlptCoverageChartProps) {
    const [index, setIndex] = useState<GrammarJlptIndex | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let mounted = true;

        GrammarService.loadJlptIndex()
            .then(idx => { if (mounted) setIndex(idx); })
            .catch(() => { if (mounted) setFailed(true); });

        return () => { mounted = false; };
    }, []);

    const rows = useMemo<JlptLevelRow[]>(() => {
        if (!index) return [];

        const masteredIds = new Set<string>();
        const learningIds = new Set<string>();
        for (const g of progress.grammarQueue || []) {
            if (isGrammarFullyMastered(g)) masteredIds.add(g.grammarId);
            else learningIds.add(g.grammarId);
        }

        return GRAMMAR_JLPT_LEVELS.map(level => {
            const ids = index[level] ?? [];
            let mastered = 0;
            let learning = 0;

            for (const id of ids) {
                if (masteredIds.has(id)) mastered++;
                else if (learningIds.has(id)) learning++;
            }

            return { key: level, label: `N${level}`, mastered, learning, total: ids.length };
        });
    }, [index, progress.grammarQueue]);

    if (failed) {
        return <p className="text-sm text-tertiary">Grammar JLPT data unavailable.</p>;
    }

    if (!index) {
        return <div className="h-40 animate-pulse rounded bg-surface-hover/40" />;
    }

    return <JlptCoverageBars rows={rows} itemLabel="grammar points" headline="JLPT grammar points covered" />;
}
