// Pure helpers behind the grammar curriculum pages (issue #58): resolving where a point sits
// in the authored teaching order. Kept out of prerender.ts and the page components so the
// lookup logic is unit-testable without rendering anything or touching the filesystem.

import type { GrammarTeachingOrder } from '../models/grammar.model';

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
