import { describe, expect, it } from 'vitest';
import { TagsLookup, shortTagLabel } from './tags';

describe('shortTagLabel', () => {
    it('gives the short label for common parts of speech', () => {
        expect(shortTagLabel('n')).toBe('Noun');
        expect(shortTagLabel('adj-no')).toBe('No-adjective');
        expect(shortTagLabel('v5k')).toBe('Godan verb (-ku)');
        expect(shortTagLabel('vi')).toBe('Intransitive');
    });

    it('falls back to the full description', () => {
        expect(shortTagLabel('v2g-s')).toBe(TagsLookup['v2g-s']);
    });
});
