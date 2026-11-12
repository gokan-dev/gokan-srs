import { describe, expect, it } from 'vitest';
import { isSearchIndexPart, SEARCH_INDEX_PARTS } from './searchIndexParts';

describe('isSearchIndexPart', () => {
    it('accepts the two files of the index and nothing else', () => {
        expect(SEARCH_INDEX_PARTS.every(isSearchIndexPart)).toBe(true);
        expect(isSearchIndexPart('other')).toBe(false);
        expect(isSearchIndexPart('')).toBe(false);
    });
});