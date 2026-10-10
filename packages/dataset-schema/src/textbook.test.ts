import { describe, it, expect } from 'vitest';
import { textbookLessonsLabel } from './textbook';

describe('textbookLessonsLabel', () => {
    it('names each book and lesson', () => {
        expect(textbookLessonsLabel([{ book: 'genki', lesson: 10 }, { book: 'intermediate-japanese', lesson: 2 }]))
            .toBe('Genki L10, Intermediate Japanese L2');
        expect(textbookLessonsLabel([])).toBe('');
    });
});
