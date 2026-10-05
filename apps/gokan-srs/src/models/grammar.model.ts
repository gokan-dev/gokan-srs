import { DEFAULT_SRS_ENTRY } from './vocabulary.model';
import type { SRSEntry } from './vocabulary.model';
import type { GrammarContrastCase } from '@gokan/dataset-schema';

/*
 * Grammar types the SRS app derives for itself. The dataset's grammar files (GrammarPoint,
 * the indexes, ...) are typed in @gokan/dataset-schema.
 */

/**
 * One point's interchangeable siblings, flattened with the family context, for
 * lookup by point id. `siblings` excludes the point itself.
 */
export interface GrammarInterchangeableForPoint {
    familyId: string;
    familyName: string;
    siblings: string[];
}

/** A contrast case flattened with the family/lesson context it came from, keyed for lookup by its focus point. */
export interface GrammarContrastForFocus {
    familyId: string;
    familyName: string;
    lessonId: string;
    lessonTitle: string;
    case: GrammarContrastCase;
}

/**
 * User's SRS progress for one grammar point. Mirrors VocabProgress but with a
 * single SRSEntry (no reading/meaning split) - a grammar quiz has exactly one
 * quiz type, the fill-in-the-blank translation exercise.
 */
export interface GrammarProgress {
    grammarId: string;
    stage: 'learning' | 'graduated';
    introductionAt: Date | null;
    nextReviewAt: Date | null;
    lastReviewedAt: Date | null;
    totalReviews: number;
    consecutiveFailures: number;
    entry: SRSEntry;
    /** Immediate-retry flag, mirroring VocabProgress.needsRetry but a single boolean (only one quiz type here). */
    needsRetry?: boolean;
}

export const DEFAULT_GRAMMAR_PROGRESS: GrammarProgress = {
    grammarId: '',
    stage: 'learning',
    introductionAt: null,
    nextReviewAt: null,
    lastReviewedAt: null,
    totalReviews: 0,
    consecutiveFailures: 0,
    entry: { ...DEFAULT_SRS_ENTRY },
};
