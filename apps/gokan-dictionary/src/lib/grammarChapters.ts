// Pure helpers behind the grammar curriculum pages (issue #58): resolving where a point sits
// in the authored teaching order. Kept out of prerender.ts and the page components so the
// lookup logic is unit-testable without rendering anything or touching the filesystem.

import type { GrammarPoint, GrammarTeachingOrder } from '../models/grammar.model';
import type { GrammarSummary } from './types';

/** Where one grammar point sits in the curriculum. */
export interface ChapterLocator {
    chapterId: string;
    chapterTitle: string;
    /** 1-based position among ALL chapters, e.g. 14 for "Chapter 14". */
    chapterNumber: number;
    /** 1-based position within the chapter's own point list. */
    positionInChapter: number;
    totalInChapter: number;
}

/**
 * Point id -> its chapter locator. A point absent from every chapter's `points` (a non-canonical
 * variant realization, taught only via its canonical - see `variantOf`) simply has no entry;
 * callers treat that as "no locator to show" rather than an error.
 */
export function buildChapterLocatorIndex(order: GrammarTeachingOrder): Map<string, ChapterLocator> {
    const index = new Map<string, ChapterLocator>();

    order.chapters.forEach((chapter, chapterIndex) => {
        chapter.points.forEach((pointId, pointIndex) => {
            index.set(pointId, {
                chapterId: chapter.id,
                chapterTitle: chapter.title,
                chapterNumber: chapterIndex + 1,
                positionInChapter: pointIndex + 1,
                totalInChapter: chapter.points.length,
            });
        });
    });

    return index;
}

/** One chapter, resolved for display: its own metadata plus its member points as summaries. */
export interface ChapterIndexRow {
    id: string;
    title: string;
    summary: string;
    jlptLevel: number;
    /** 1-based position among all chapters. */
    chapterNumber: number;
    points: GrammarSummary[];
}

/**
 * Every chapter, in teaching order, with its points resolved to display summaries. Backs both
 * the chapters index page (title/summary/point count) and each chapter's own detail page (full
 * point list) - one row shape, since the index page's row is exactly the detail page's data.
 * A point id absent from `pointsById` is dropped rather than rendered blank.
 */
export function buildChapterIndexRows(order: GrammarTeachingOrder, pointsById: Map<string, GrammarPoint>): ChapterIndexRow[] {
    return order.chapters.map((chapter, chapterIndex) => ({
        id: chapter.id,
        title: chapter.title,
        summary: chapter.summary,
        jlptLevel: chapter.jlptLevel,
        chapterNumber: chapterIndex + 1,
        points: chapter.points
            .map(id => pointsById.get(id))
            .filter((point): point is GrammarPoint => Boolean(point))
            .map(point => ({ id: point.id, title: point.title, jlptLevel: point.jlptLevel })),
    }));
}
