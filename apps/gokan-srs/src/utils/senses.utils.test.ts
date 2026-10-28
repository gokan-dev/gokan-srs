import { describe, expect, it } from 'vitest';
import { TagsLookup } from '@gokan/dataset-schema';
import type { Sense } from '@gokan/dataset-schema';
import { isRareSense, organizeSenses, senseNumbers } from './senses.utils';

const sense = (pos: string[], glosses: string[], rawTags: string[] = []): Sense =>
    ({ pos, misc: { rawTags }, glosses, related: { compounds: [] } });

// gokan-dataset's synonym build leaves out the senses this hides, so a pair never goes
// through a sense the page does not show: the two must agree on every tag.
// import.meta.glob rather than an import, so a missing submodule fails this test rather
// than the typecheck.
const datasetBuild = Object.values(import.meta.glob<{ isRareSense: (sense: Pick<Sense, 'misc'>) => boolean }>(
    '../../dataset/scripts/build-synonyms.ts', { eager: true }
));

describe('isRareSense', () => {
    it("agrees with gokan-dataset's synonym build on every tag and flag", () => {
        expect(datasetBuild).toHaveLength(1);
        const cases: Pick<Sense, 'misc'>[] = [
            ...Object.keys(TagsLookup).map(tag => ({ misc: { rawTags: [tag] } })),
            { misc: { rawTags: [], isArchaic: true } },
            { misc: { rawTags: [], isRare: true } },
        ];
        expect(cases.filter(c => datasetBuild[0]?.isRareSense(c) !== isRareSense(c)).map(c => c.misc)).toEqual([]);
        expect(cases.filter(isRareSense)).toHaveLength(6);
    });
});

describe('organizeSenses', () => {
    it('shows a part-of-speech line only where it changes', () => {
        const { common } = organizeSenses([
            sense(['n'], ['school']),
            sense(['n'], ['study']),
            sense(['vs', 'vt'], ['to study']),
        ]);
        expect(common.map(s => s.posLabel)).toEqual(['Noun', null, 'Suru verb, Transitive']);
    });

    it('moves archaic, obsolete and rare senses to their own group', () => {
        const { common, rare } = organizeSenses([
            sense(['n'], ['school']),
            sense(['n'], ['old meaning'], ['arch']),
            sense(['n'], ['learning']),
        ]);
        expect(common.map(s => s.sense.glosses[0])).toEqual(['school', 'learning']);
        expect(rare.map(s => s.sense.glosses[0])).toEqual(['old meaning']);
        expect(rare[0].posLabel).toBe('Noun');
    });
});

describe('senseNumbers', () => {
    const misc = (rare: boolean): Pick<Sense, 'misc'> => ({ misc: { rawTags: [], ...(rare ? { isRare: true } : {}) } });

    it('numbers the common senses first, then the rare ones after them, as the page lists them', () => {
        expect(senseNumbers([misc(false), misc(true), misc(false), misc(true), misc(false)])).toEqual([1, 4, 2, 5, 3]);
    });

    it('numbers from 1 a word whose every sense is rare', () => {
        expect(senseNumbers([misc(true), misc(true)])).toEqual([1, 2]);
    });
});
