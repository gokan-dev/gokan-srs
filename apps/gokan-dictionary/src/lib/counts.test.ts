import { describe, expect, it } from 'vitest';
import { countLabel } from './counts';

describe('countLabel', () => {
    it('writes the singular for exactly one, the plural otherwise, the number grouped', () => {
        expect(countLabel(0, 'word')).toBe('0 words');
        expect(countLabel(1, 'word')).toBe('1 word');
        expect(countLabel(1000, 'word')).toBe('1,000 words');
    });
});
