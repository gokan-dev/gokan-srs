import { describe, expect, it } from 'vitest';
import { CLOSENESS_LABEL, FREQUENT_WORDS, normalizeGloss, pairCloseness, synonymEntriesOf, synonymSections, type SectionedSynonym } from './synonyms';
import type { Sense } from './vocabulary';

const sense = (glosses: string[], misc: Partial<Sense['misc']> = {}): Pick<Sense, 'glosses' | 'misc'> => ({ glosses, misc: { rawTags: [], ...misc } });
const pair = (vocabId: string, { shared = ['shine'], rank = 100, tier = 'confusable', curated = false }: Partial<SectionedSynonym> = {}): SectionedSynonym =>
    ({ vocabId, shared, rank, tier, curated });
const ids = (section: { words: SectionedSynonym[] } | undefined) => section?.words.map(w => w.vocabId);

describe('normalizeGloss', () => {
    it('drops case, parentheticals, a leading "to" or article and punctuation', () => {
        expect(normalizeGloss('To shine (brightly).')).toBe('shine');
        expect(normalizeGloss('the  Moon, at night')).toBe('moon at night');
    });
});

describe('synonymEntriesOf', () => {
    it('names the other word from the forms the dataset embeds, a word learned in kana by its kana', () => {
        const [kanji, kana, unranked] = synonymEntriesOf({ synonyms: [
            { id: '1', relation: 'interchangeable', shared: ['shine'], curated: true, w: ['光る', '晃る'], r: ['ひかる'], f: 900 },
            { id: '2', relation: 'confusable', w: ['此処'], r: ['ここ'], u: true, f: 20 },
            { id: '3', relation: 'confusable', w: [], r: ['きらきら'] },
        ] });
        expect(kanji).toEqual({
            vocabId: '1', shared: ['shine'], rank: 900, tier: 'interchangeable', curated: true,
            forms: { writtenForm: { kanji: '光る', alternatives: ['晃る'], containedKanji: [] }, reading: { primary: 'ひかる', alternatives: [] } },
        });
        expect(kana.forms.usuallyKana).toBe(true);
        expect([kana.shared, kana.curated]).toEqual([[], false]);
        expect([unranked.rank, unranked.forms.writtenForm.kanji]).toEqual([null, 'きらきら']);
        expect(synonymEntriesOf({})).toEqual([]);
    });
});

describe('synonymSections without a layer (the dictionary)', () => {
    const kagayaku = [sense(['to shine', 'to sparkle']), sense(['to beam'])];

    it('orders curated, shared in this sense, interchangeable, frequent', () => {
        const words = [
            pair('frequent', { rank: 1 }),
            pair('interchangeable', { tier: 'interchangeable', rank: 50 }),
            pair('sharesTwo', { shared: ['shine', 'sparkle'], rank: 60 }),
            pair('curated', { curated: true, rank: 80 }),
        ];
        expect(ids(synonymSections(kagayaku, words)[0])).toEqual(['curated', 'sharesTwo', 'interchangeable', 'frequent']);
    });

    it(`leaves out every word outside the ${FREQUENT_WORDS.toLocaleString('en-US')} most frequent`, () => {
        const words = [pair('common', { rank: FREQUENT_WORDS }), pair('rare', { rank: FREQUENT_WORDS + 1 }), pair('unranked', { rank: null })];
        expect(ids(synonymSections(kagayaku, words)[0])).toEqual(['common']);
    });

    it('lets a layer keep a rare word and order ahead of the curated pairs', () => {
        const words = [pair('curated', { curated: true }), pair('kept', { rank: null })];
        const sections = synonymSections(kagayaku, words, { keeps: w => w.vocabId === 'kept', lead: (x, y) => Number(y.vocabId === 'kept') - Number(x.vocabId === 'kept'), afterCurated: () => 0 });
        expect(ids(sections[0])).toEqual(['kept', 'curated']);
    });
});

describe('pairCloseness', () => {
    const glosses = ['to shine', 'to sparkle'];

    it('reads a pair in the sense it is listed under', () => {
        expect(pairCloseness(pair('a', { tier: 'interchangeable', shared: ['beam'] }), glosses)).toBe('interchangeable');
        expect(pairCloseness(pair('b', { shared: ['shine'] }), glosses)).toBe('close');
        expect(pairCloseness(pair('c', { shared: ['beam'] }), glosses)).toBe('distinct');
        expect(pairCloseness(pair('d', { shared: ['shine'], curated: true }), glosses)).toBe('distinct');
        expect(pairCloseness(pair('e', { tier: 'interchangeable', shared: [], curated: true }), glosses)).toBe('interchangeable');
    });

    it('labels each closeness by a sign and a word', () => {
        expect(Object.values(CLOSENESS_LABEL).map(l => `${l.sign} ${l.label}`)).toEqual(['= Interchangeable', '≈ Close in this sense', '≠ Not interchangeable']);
    });
});
