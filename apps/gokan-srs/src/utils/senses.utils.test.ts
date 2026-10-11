import { describe, expect, it } from 'vitest';
import type { Sense } from '@gokan/dataset-schema';
import { organizeSenses } from './senses.utils';

const sense = (pos: string[], glosses: string[], rawTags: string[] = []): Sense =>
    ({ pos, misc: { rawTags }, glosses, related: { compounds: [] } });

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
