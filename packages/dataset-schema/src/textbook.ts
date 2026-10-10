import type { TextbookLesson } from './vocabulary';

const BOOK_NAMES: Record<TextbookLesson['book'], string> = {
    genki: 'Genki',
    'intermediate-japanese': 'Intermediate Japanese',
};

/** "Genki L10, Intermediate Japanese L2": the lessons that teach a word, in the order given. */
export function textbookLessonsLabel(lessons: readonly TextbookLesson[]): string {
    return lessons.map(l => `${BOOK_NAMES[l.book]} L${l.lesson}`).join(', ');
}
