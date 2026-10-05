import { describe, it, expect } from 'vitest';
import { matches, filterEntries, scoreEntry } from './search';
import type { SearchIndex, SearchIndexEntry } from '@gokan/dataset-schema';

const OMOU: SearchIndexEntry = { id: '1589350', w: '思う', r: 'おもう', m: 'to think, to consider' };
const IU: SearchIndexEntry = { id: '1587040', w: '言う', r: 'いう', m: 'to say, to utter' };
const INDEX: SearchIndex = [OMOU, IU];

const HON: SearchIndexEntry = { id: '1', w: '本', r: 'ほん', m: 'book' };
const NIHON: SearchIndexEntry = { id: '2', w: '日本', r: 'にほん', m: 'Japan' };
const HONTOU: SearchIndexEntry = { id: '3', w: '本当', r: 'ほんとう', m: 'truth, reality' };

describe('matches', () => {
    it('matches on the kanji written form', () => {
        expect(matches(OMOU, '思')).toBe(true);
    });

    it('matches on the reading', () => {
        expect(matches(OMOU, 'おも')).toBe(true);
    });

    it('matches on the meaning, case-insensitively', () => {
        expect(matches(OMOU, 'THINK')).toBe(true);
    });

    it('does not match unrelated queries', () => {
        expect(matches(OMOU, 'banana')).toBe(false);
    });
});

describe('scoreEntry', () => {
    it('scores an exact written form or reading above a prefix, and a prefix above a substring', () => {
        expect(scoreEntry(HON, '本')).toBeGreaterThan(scoreEntry(HONTOU, '本'));
        expect(scoreEntry(HONTOU, '本')).toBeGreaterThan(scoreEntry(NIHON, '本'));
    });

    it('scores a Japanese-field match above an English gloss match', () => {
        // 'Japan' as a gloss must not outrank a word whose reading actually starts with the query.
        expect(scoreEntry(NIHON, 'にほん')).toBeGreaterThan(scoreEntry(NIHON, 'japan'));
    });

    it('scores an exact sense above a mention buried in a longer definition', () => {
        const exact: SearchIndexEntry = { id: '4', w: '真実', r: 'しんじつ', m: 'truth, reality' };
        const buried: SearchIndexEntry = { id: '5', w: '嘘', r: 'うそ', m: 'a lie, the opposite of truth' };
        expect(scoreEntry(exact, 'truth')).toBeGreaterThan(scoreEntry(buried, 'truth'));
    });

    it('returns 0 for a non-match and for a blank query', () => {
        expect(scoreEntry(OMOU, 'banana')).toBe(0);
        expect(scoreEntry(OMOU, '   ')).toBe(0);
    });
});

describe('filterEntries', () => {
    it('returns entries matching the query', () => {
        expect(filterEntries(INDEX, 'say', 20)).toEqual([IU]);
    });

    it('returns an empty array for a blank query', () => {
        expect(filterEntries(INDEX, '   ', 20)).toEqual([]);
    });

    it('ranks the exact match first rather than whatever the index happened to list first', () => {
        // The regression this ranking exists for: 本 is last in index order here, and a plain
        // substring filter would have returned 日本 and 本当 ahead of the word itself.
        expect(filterEntries([NIHON, HONTOU, HON], '本', 3)[0]).toBe(HON);
    });

    it('caps results at maxResults, keeping the best-ranked one', () => {
        // Both glosses start with "to"; the shorter entry wins the tie as the more basic word.
        expect(filterEntries(INDEX, 'to', 1)).toEqual([IU]);
    });

    it('returns an empty array when nothing matches', () => {
        expect(filterEntries(INDEX, 'xyz', 20)).toEqual([]);
    });
});
