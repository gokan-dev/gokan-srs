// Pure helpers behind the grammar browse pages: a point reduced to a list row, the teaching order
// the rows are listed in, and grouping by JLPT level. Kept out of prerender.ts and the page
// components so what a reader sees, and in which order, is unit-tested.

import { JLPT_LEVELS } from '@gokan/dataset-schema';
import type { GrammarPoint } from '@gokan/dataset-schema';
import type { GrammarSummary } from './types';
import { SHORT_GLOSS_LENGTH, truncateAtWord } from './vocabSummary';

/** A point as a list row links to it: title, level, romaji and its short explanation, cut short. */
export function grammarSummaryOf(point: GrammarPoint): GrammarSummary {
    return {
        id: point.id,
        title: point.title,
        jlptLevel: point.jlptLevel,
        ...(point.romaji ? { romaji: point.romaji } : {}),
        shortExplanation: truncateAtWord(point.shortExplanation, SHORT_GLOSS_LENGTH),
    };
}

/**
 * `points` in the authored teaching order (`order`, from teaching-order.json), the order a learner
 * meets them in. Points the order leaves out (realization variants, taught through their
 * canonical) follow, in their given order.
 */
export function inTeachingOrder(points: GrammarPoint[], order: string[]): GrammarPoint[] {
    const position = new Map(order.map((id, index) => [id, index]));
    const ordered = points.filter(point => position.has(point.id));
    ordered.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    return [...ordered, ...points.filter(point => !position.has(point.id))];
}

export interface LevelGroup<T> {
    level: number;
    items: T[];
}

/** Items grouped by JLPT level, N5 first, keeping their order within a level; empty levels left out. */
export function groupByLevel<T extends { jlptLevel: number }>(items: T[]): LevelGroup<T>[] {
    return JLPT_LEVELS
        .map(level => ({ level, items: items.filter(item => item.jlptLevel === level) }))
        .filter(group => group.items.length > 0);
}
