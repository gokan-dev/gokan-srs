import { describe, it, expect } from 'vitest';
import type { Sense, Vocabulary } from '@gokan/dataset-schema';
import { closenessOf, listedSynonymsOf } from '../services/exercise/wordRelation';
import type { ListedSynonym } from '../services/exercise/wordRelation';
import {
    COLLAPSED_SECTIONS, COLLAPSED_WORDS, EXPANDED_WORDS, FREQUENT_WORDS, hasMoreSynonyms, shownSections, synonymSections,
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

describe('shownSections (the caps)', () => {
    const senses = Array.from({ length: 5 }, (_, i) => sense([`meaning${i}`]));
    const words = senses.flatMap((_, i) => Array.from({ length: 12 }, (__, j) => listed(`w${i}-${j}`, { shared: [`meaning${i}`], rank: j + 1 })));
    const sections = synonymSections(senses, words, nobody);

    it(`collapsed: the first ${COLLAPSED_SECTIONS} sections, ${COLLAPSED_WORDS} words each`, () => {
        const shown = shownSections(sections, false, new Map());
        expect(shown.map(s => [s.sense, s.shown.length, s.hidden])).toEqual([[0, 3, 9], [1, 3, 9], [2, 3, 9]]);
    });

    it('collapsed: plus any section holding a word the learner mixed up', () => {
        const mixedUp = new Map([['w4-11', 1]]);
        const shown = shownSections(synonymSections(senses, words, { ...nobody, mixedUp }), false, mixedUp);
        expect(shown.map(s => s.sense)).toEqual([0, 1, 2, 4]);
        expect(shown.at(-1)?.shown[0].vocabId).toBe('w4-11');
    });

    it(`expanded: every section, ${EXPANDED_WORDS} words each, with how many it leaves out`, () => {
        const shown = shownSections(sections, true, new Map());
        expect(shown.map(s => [s.shown.length, s.hidden])).toEqual(Array.from({ length: 5 }, () => [10, 2]));
    });

    it('offers to expand only when that shows more', () => {
        expect(hasMoreSynonyms(sections, new Map())).toBe(true);
        const small = synonymSections(senses.slice(0, 2), [listed('a', { shared: ['meaning0'] })], nobody);
        expect(hasMoreSynonyms(small, new Map())).toBe(false);
    });
});

// On the real compiled dataset: fails rather than passes when the submodule is missing.
const files = import.meta.glob<Vocabulary>('../../dataset/compiled/vocab/{1487400,1224020,1237680,1288810,1288850,1496670}.json', { eager: true, import: 'default' });
const vocabById = new Map(Object.values(files).map(v => [v.id, v]));

describe('the Synonyms card, on the compiled dataset', () => {
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

    it("lists 光る on 輝く's card under \"to shine\", where the collapsed card shows it", () => {
        expect(find('1224020', '1272820')?.section.glosses[0]).toBe('to shine');
        const [first] = shownSections(sectionsOf('1224020'), false, new Map());
        expect(first.shown.map(w => w.vocabId)).toContain('1272820');
    });

    it("lists 小さい on 狭い's card under its first sense", () => {
        expect(find('1237680', '1347750')?.section.sense).toBe(0);
    });
});
