import { describe, it, expect } from 'vitest';
import { containsWholeWord } from './wholeWord';

describe('containsWholeWord', () => {
    it('finds the word between separators, at either end or alone', () => {
        expect(containsWholeWord('car; automobile', 'car')).toBe(true);
        expect(containsWholeWord('house; residence', 'residence')).toBe(true);
        expect(containsWholeWord('to eat', 'to eat')).toBe(true);
        expect(containsWholeWord('okara (soy pulp)', 'soy')).toBe(true);
    });

    it('skips a match inside a longer word, and finds a later whole one', () => {
        expect(containsWholeWord('cart', 'car')).toBe(false);
        expect(containsWholeWord('scar', 'car')).toBe(false);
        expect(containsWholeWord('cart; car', 'car')).toBe(true);
    });

    it('is false for an empty word', () => {
        expect(containsWholeWord('car', '')).toBe(false);
    });
});
