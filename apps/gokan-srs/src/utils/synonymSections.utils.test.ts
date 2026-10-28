import { describe, it, expect } from 'vitest';
import type { Sense, Vocabulary } from '@gokan/dataset-schema';
import { closenessOf, listedSynonymsOf } from '../services/exercise/wordRelation';
import type { ListedSynonym } from '../services/exercise/wordRelation';
import {
    CLOSEST_SYNONYMS, FREQUENT_WORDS, closestSynonyms, filterSynonymSections, sectionGlossLine, shownGroups, synonymCount, synonymSections,
} from './synonymSections.utils';
import type { SynonymLearner } from './synonymSections.utils';

const sense = (glosses: string[], misc: Partial<Sense['misc']> = {}): Pick<Sense, 'glosses' | 'misc'> => ({ glosses, misc: { rawTags: [], ...misc } });

function listed(vocabId: string, { shared = ['shine'], rank = 100, tier = 'confusable', curated = false }: Partial<Pick<ListedSynonym, 'shared' | 'rank' | 'tier' | 'curated'>> = {}): ListedSynonym {
    return {
        vocabId, shared, rank, tier, curated,
        forms: { writtenForm: { kanji: vocabId, alternatives: [], containedKanji: [] }, reading: { primary: vocabId, alternatives: [] } },
        pair: { relation: tier, shared, curated },
    };
}

const nobody: SynonymLearner = { studied: new Set(), mixedUp: new Map() };
const ids = (section: { words: ListedSynonym[] } | undefined) => section?.words.map(w => w.vocabId);

describe('synonymSections', () => {
    const kagayaku = [sense(['to shine', 'to sparkle', 'to glitter']), sense(['to light up', 'to beam', 'to gleam'])];

    it('makes one section per sense, each synonym once, under the sense it shares the most with', () => {
        const sections = synonymSections(kagayaku, [
            listed('hikaru', { shared: ['glitter', 'shine'] }),
            listed('hikari', { shared: ['beam', 'gleam', 'shine'] }),
            listed('kirameku', { shared: ['sparkle', 'gleam'] }),
        ], nobody);
        expect(sections.map(s => [s.sense, ids(s)])).toEqual([[0, ['hikaru', 'kirameku']], [1, ['hikari']]]);
    });

    it('compares glosses after normalizeGloss, so "to shine" carries "shine"', () => {
        expect(ids(synonymSections([sense(['To shine (brightly)'])], [listed('hikaru', { shared: ['shine'] })], nobody)[0])).toEqual(['hikaru']);
    });

    it('gives a rare or archaic sense no section, and drops a pair that only shares one', () => {
        const sections = synonymSections(
            [sense(['narrow']), sense(['small'], { isRare: true }), sense(['tight'], { isArchaic: true })],
            [listed('hosoi', { shared: ['narrow'] }), listed('chiisai', { shared: ['small'] }), listed('kitsui', { shared: ['tight'] })],
            nobody,
        );
        expect(sections.map(s => [s.sense, ids(s)])).toEqual([[0, ['hosoi']]]);
    });

    it('gives the senses of a word whose every sense is rare their sections, as the dataset pairs through them (婦人)', () => {
        const sections = synonymSections([sense(['woman', 'lady', 'adult female'], { rawTags: ['dated'] })], [listed('josei', { shared: ['woman'] })], nobody);
        expect(sections.map(s => [s.sense, ids(s)])).toEqual([[0, ['josei']]]);
    });

    it('puts a pair set by hand with no meaning in common under the first sense', () => {
        expect(ids(synonymSections(kagayaku, [listed('teru', { shared: [], curated: true })], nobody)[0])).toEqual(['teru']);
    });

    it(`leaves out a word outside the ${FREQUENT_WORDS.toLocaleString('en-US')} most frequent, unless the learner studies it`, () => {
        const words = [listed('common', { rank: FREQUENT_WORDS }), listed('rare', { rank: FREQUENT_WORDS + 1 }), listed('unranked', { rank: null })];
        expect(ids(synonymSections(kagayaku, words, nobody)[0])).toEqual(['common']);
        expect(ids(synonymSections(kagayaku, words, { ...nobody, studied: new Set(['rare', 'unranked']) })[0])).toEqual(['rare', 'unranked', 'common']);
    });

    it('orders: mixed up (most often first), curated, studied, shared in this sense, interchangeable, frequent', () => {
        const words = [
            listed('frequent', { rank: 1 }),
            listed('interchangeable', { tier: 'interchangeable', rank: 50 }),
            listed('sharesTwo', { shared: ['shine', 'sparkle'], rank: 60 }),
            listed('studied', { rank: 70 }),
            listed('curated', { curated: true, rank: 80 }),
            listed('mixedOnce', { rank: 90 }),
            listed('mixedTwice', { rank: 95 }),
            listed('rarer', { rank: 9000 }),
        ];
        const learner: SynonymLearner = { studied: new Set(['studied']), mixedUp: new Map([['mixedOnce', 1], ['mixedTwice', 2]]) };
        expect(ids(synonymSections(kagayaku, words, learner)[0]))
            .toEqual(['mixedTwice', 'mixedOnce', 'curated', 'studied', 'sharesTwo', 'interchangeable', 'frequent', 'rarer']);
    });

    it('has no section for a word without synonyms', () => {
        expect(synonymSections(kagayaku, [], nobody)).toEqual([]);
    });
});

describe('the word page: Closest synonyms and the Explore panel', () => {
    const senses = Array.from({ length: 6 }, (_, i) => sense([`meaning${i}`]));
    const words = senses.flatMap((_, i) => Array.from({ length: 8 }, (__, j) => listed(`w${i}-${j}`, { shared: [`meaning${i}`], rank: j + 1 })));
    const sections = synonymSections(senses, words, nobody);
    const never = () => false;

    it(`Closest synonyms: the first section's best ${CLOSEST_SYNONYMS}, leaving out a pair never accepted`, () => {
        expect(closestSynonyms(sections, never)?.words.map(w => w.vocabId)).toEqual(['w0-0', 'w0-1', 'w0-2', 'w0-3', 'w0-4']);
        const distinct = closestSynonyms(sections, w => w.vocabId === 'w0-1');
        expect(distinct?.words.map(w => w.vocabId)).toEqual(['w0-0', 'w0-2', 'w0-3', 'w0-4', 'w0-5']);
        expect(closestSynonyms(sections.slice(0, 1), () => true)).toBeNull();
        expect(closestSynonyms([], never)).toBeNull();
    });

    it('names a section by its first two glosses', () => {
        expect(sectionGlossLine({ glosses: ['to get', 'to obtain', 'to acquire'] })).toBe('to get, to obtain');
        expect(sectionGlossLine({ glosses: ['to shine'] })).toBe('to shine');
    });

    it('counts every listed word once', () => {
        expect(synonymCount(sections)).toBe(48);
    });

    it('lists the first groups, plus any holding a word the learner mixed up, and how many are left', () => {
        expect(shownGroups(sections, 4, new Map())).toMatchObject({ hidden: 2 });
        expect(shownGroups(sections, 4, new Map()).shown.map(s => s.sense)).toEqual([0, 1, 2, 3]);
        const mixed = shownGroups(sections, 4, new Map([['w5-7', 1]]));
        expect([mixed.shown.map(s => s.sense), mixed.hidden]).toEqual([[0, 1, 2, 3, 5], 1]);
        expect(shownGroups(sections, 8, new Map()).hidden).toBe(0);
    });

    it('keeps the grouping under a search, dropping a group with no match', () => {
        const kept = filterSynonymSections(sections, w => w.vocabId.endsWith('-3') && !w.vocabId.startsWith('w2'));
        expect(kept.map(s => [s.sense, ids(s)])).toEqual([[0, ['w0-3']], [1, ['w1-3']], [3, ['w3-3']], [4, ['w4-3']], [5, ['w5-3']]]);
    });
});

// On the real compiled dataset: fails rather than passes when the submodule is missing.
const files = import.meta.glob<Vocabulary>('../../dataset/compiled/vocab/{1487400,1224020,1237680,1288810,1288850,1496670}.json', { eager: true, import: 'default' });
const vocabById = new Map(Object.values(files).map(v => [v.id, v]));

describe('the Synonyms panel and Closest synonyms, on the compiled dataset', () => {
    const sectionsOf = (id: string) => {
        const vocab = vocabById.get(id);
        expect(vocab, `compiled/vocab/${id}.json`).toBeDefined();
        return vocab ? synonymSections(vocab.senses, listedSynonymsOf(vocab), nobody) : [];
    };
    const find = (id: string, other: string) => sectionsOf(id).flatMap(s => s.words.map(w => ({ section: s, word: w }))).find(e => e.word.vocabId === other);

    it("loads every case word's file", () => {
        expect(['1487400', '1224020', '1237680', '1288810', '1288850', '1496670'].filter(id => !vocabById.has(id))).toEqual([]);
    });

    it("does not list 来 on ここ's card: its \"next ...\" is a prefix (reported)", () => {
        expect(find('1288810', '1547710')).toBeUndefined();
    });

    it("lists もう一人 on 今's card as Close in this sense, not Interchangeable (reported)", () => {
        const entry = find('1288850', '2267340');
        expect(entry).toBeDefined();
        if (entry) expect(closenessOf(entry.word.pair, entry.section.glosses)).toBe('close');
    });

    it("lists 女性 on 婦人's card, though its one sense is dated", () => {
        expect(find('1496670', '1345250')).toBeDefined();
    });

    it("lists 常に on 必ず's card as Not interchangeable", () => {
        const entry = find('1487400', '1355970');
        expect(entry).toBeDefined();
        if (entry) expect(closenessOf(entry.word.pair, entry.section.glosses)).toBe('distinct');
    });

    it("lists 光る on 輝く's card under \"to shine\", among its Closest synonyms", () => {
        expect(find('1224020', '1272820')?.section.glosses[0]).toBe('to shine');
        const closest = closestSynonyms(sectionsOf('1224020'), (w, section) => closenessOf(w.pair, section.glosses) === 'distinct');
        expect(closest?.words.map(w => w.vocabId)).toContain('1272820');
    });

    it("leaves 常に out of 必ず's Closest synonyms, though the panel lists it", () => {
        const closest = closestSynonyms(sectionsOf('1487400'), (w, section) => closenessOf(w.pair, section.glosses) === 'distinct');
        expect(closest?.words.map(w => w.vocabId) ?? []).not.toContain('1355970');
    });

    it("lists 小さい on 狭い's card under its first sense", () => {
        expect(find('1237680', '1347750')?.section.sense).toBe(0);
    });
});
