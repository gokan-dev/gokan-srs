import type { GrammarChapterProgressCounts } from "../context/quiz/grammarSelectors";

/**
 * "1 mastered · 2 learning · 1 new": always in that order, zero parts omitted,
 * so a chapter not started reads just "4 new".
 */
export function chapterProgressLabel({ mastered, learning, total }: GrammarChapterProgressCounts): string {
    const fresh = total - mastered - learning;
    return [
        mastered > 0 ? `${mastered} mastered` : null,
        learning > 0 ? `${learning} learning` : null,
        fresh > 0 ? `${fresh} new` : null,
    ].filter(Boolean).join(' · ');
}

/**
 * The curriculum's chapters under level headings: consecutive chapters of one
 * level form a group, so the teaching order is kept even where it returns to a
 * level. Each chapter keeps its 1-based number in the whole curriculum.
 */
export function groupChaptersByLevel<T extends { jlptLevel: number }>(chapters: readonly T[]): { level: number; chapters: { chapter: T; number: number }[] }[] {
    const groups: { level: number; chapters: { chapter: T; number: number }[] }[] = [];
    chapters.forEach((chapter, i) => {
        const last = groups.at(-1);
        const entry = { chapter, number: i + 1 };
        if (last?.level === chapter.jlptLevel) last.chapters.push(entry);
        else groups.push({ level: chapter.jlptLevel, chapters: [entry] });
    });
    return groups;
}
