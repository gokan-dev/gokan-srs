import type { GrammarBrowseRow } from "@gokan/dataset-schema";
import type { GrammarProgress } from "../models/grammar.model";
import { grammarNextReviewAt } from "../services/grammarScheduling";
import type { PacingSettings } from "../services/calibration";
import { grammarLearningStatus, type LearningStatus } from "./learningStatus.utils";

export type GrammarStatusFilter = LearningStatus | 'all';
export type GrammarSort = 'teaching' | 'next_review' | 'mistakes' | 'mastery';

export const GRAMMAR_SORT_LABEL: Record<GrammarSort, string> = {
    teaching: 'Teaching order',
    next_review: 'Next review',
    mistakes: 'Most mistakes',
    mastery: 'Mastery',
};

const LAST = Number.MAX_SAFE_INTEGER;

/**
 * Sorts the All points list. Teaching order puts points outside the order (realization
 * variants) last; Next review puts points not studied yet last; Most mistakes and
 * Mastery put the most first. Ties keep teaching order.
 */
export function sortGrammarRows(
    rows: readonly GrammarBrowseRow[],
    sort: GrammarSort,
    progressById: ReadonlyMap<string, GrammarProgress>,
    settings?: Partial<PacingSettings> | null,
): GrammarBrowseRow[] {
    const key = (row: GrammarBrowseRow): number => {
        const progress = progressById.get(row.id);
        switch (sort) {
            case 'teaching': return row.orderIndex ?? LAST;
            case 'next_review': {
                const due = progress?.introductionAt ? grammarNextReviewAt(progress, settings) : null;
                return due?.getTime() ?? LAST;
            }
            case 'mistakes': return -(progress?.entry.history.filter(log => log.result === 'wrong').length ?? 0);
            case 'mastery': return -(progress?.introductionAt ? progress.entry.memoryStrength : 0);
        }
    };
    return rows
        .map(row => ({ row, key: key(row), order: row.orderIndex ?? LAST }))
        .sort((a, b) => a.key - b.key || a.order - b.order)
        .map(({ row }) => row);
}

/** Whether a point matches the All points status filter. */
export function matchesGrammarStatus(progress: GrammarProgress | undefined, status: GrammarStatusFilter): boolean {
    return status === 'all' || grammarLearningStatus(progress) === status;
}
