import { describe, expect, it } from 'vitest';
import type { VocabSynonym } from '@gokan/dataset-schema';
import { vocabulary } from '../test/fixtures';
import { PREVIEW_MEANINGS, SHIPPED_SYNONYMS, SYNONYMS_PER_MEANING, wordSynonyms } from './synonyms';

const pair = (id: string, overrides: Partial<VocabSynonym> = {}): VocabSynonym => ({ id, relation: 'confusable', shared: ['shine'], w: [`${id}字`], r: [`${id}よみ`], f: 100, ...overrides });
const kagayaku = (synonyms: VocabSynonym[]) => vocabulary({
    senses: [
        { pos: ['v5k'], misc: { rawTags: [] }, glosses: ['to shine', 'to sparkle'], related: { compounds: [] } },
        { pos: ['v5k'], misc: { rawTags: [] }, glosses: ['to be bright', 'to beam', 'to gleam'], related: { compounds: [] } },
    ],
    synonyms,
});
const everyWord = () => true;

describe('wordSynonyms', () => {
    it('groups by meaning, as the app does, each word named and labelled', () => {
        const { groups, total, left } = wordSynonyms(kagayaku([
            pair('hikaru', { relation: 'interchangeable', shared: ['shine', 'gleam'] }),
            pair('kirameku', { shared: ['gleam', 'beam'] }),
            pair('koko', { w: ['此処'], r: ['ここ'], u: true }),
        ]), everyWord);
        expect(groups).toEqual([
            { number: 1, glosses: 'to shine, to sparkle', words: [
                { id: 'hikaru', word: 'hikaru字', reading: 'hikaruよみ', closeness: 'interchangeable' },
                { id: 'koko', word: 'ここ', closeness: 'close' },
            ] },
            { number: 2, glosses: 'to be bright, to beam', words: [{ id: 'kirameku', word: 'kirameku字', reading: 'kiramekuよみ', closeness: 'close' }] },
        ]);
        expect([total, left]).toEqual([3, 0]);
    });

    it('lists only the words with a page, and none outside the frequent ones', () => {
        const { groups } = wordSynonyms(kagayaku([pair('a'), pair('b'), pair('rare', { f: 20_000 })]), id => id !== 'b');
        expect(groups.flatMap(group => group.words.map(word => word.id))).toEqual(['a']);
    });

    it(`ships ${SYNONYMS_PER_MEANING} words a meaning and ${SHIPPED_SYNONYMS} in all, and counts the rest`, () => {
        const words = Array.from({ length: 60 }, (_, i) => pair(`w${i}`, { f: i + 1, shared: [i % 2 === 0 ? 'shine' : 'beam'] }));
        const { groups, total, left } = wordSynonyms(kagayaku(words), everyWord);
        expect(groups.map(group => group.words.length)).toEqual([SYNONYMS_PER_MEANING, SYNONYMS_PER_MEANING]);
        expect([total, left]).toEqual([60, 60 - 2 * SYNONYMS_PER_MEANING]);
        expect(PREVIEW_MEANINGS).toBeLessThanOrEqual(groups.length);

        const senses = Array.from({ length: 6 }, (_, i) => ({ pos: ['n'], misc: { rawTags: [] }, glosses: [`meaning${i}`], related: { compounds: [] } }));
        const many = wordSynonyms(vocabulary({ senses, synonyms: senses.flatMap((_, i) => Array.from({ length: 10 }, (__, j) => pair(`m${i}-${j}`, { shared: [`meaning${i}`] }))) }), everyWord);
        expect(many.groups.map(group => group.words.length)).toEqual([8, 8, 8, 8]);
        expect(many.left).toBe(60 - SHIPPED_SYNONYMS);
    });

    it("gives Dict the first meaning's closest words, never a pair not interchangeable", () => {
        const { closest } = wordSynonyms(kagayaku([pair('curated', { curated: true }), pair('close'), pair('other', { shared: ['beam'] })]), everyWord);
        expect(closest).toEqual({ number: 1, glosses: 'to shine, to sparkle', words: [{ id: 'close', word: 'close字', reading: 'closeよみ', closeness: 'close' }] });
        expect(wordSynonyms(vocabulary(), everyWord)).toEqual({ groups: [], closest: null, total: 0, left: 0 });
    });
});
