import { describe, it, expect } from 'vitest';
import type { Sense, Sentence } from '@gokan/dataset-schema';
import { exampleForMeanings, markedGlosses, sensesSharing, sharedSenseType } from './sharedSense';

const sense = (pos: string[], glosses: string[]): Sense => ({ pos, glosses, misc: { rawTags: [] }, related: { compounds: [] } });

// 差す, trimmed: its "to shine" sense is vi; another sense makes the entry vt too.
const sasu = [
    sense(['v5s', 'vi'], ['to shine', 'to be visible']),
    sense(['v5s', 'vt'], ['to hold up (an umbrella)', 'to put up']),
    sense(['v5s', 'vi'], ['to appear', 'to come over']),
];
// 都合, trimmed: a noun, but its "arranging" sense is vs/vt.
const tsugou = [sense(['n'], ['circumstances', 'condition', 'convenience']), sense(['n', 'vs', 'vt'], ['arranging', 'arrangement'])];

describe('sensesSharing', () => {
    it('keeps the senses carrying a shared meaning, every sense when none does', () => {
        expect(sensesSharing(sasu, ['shine'])).toEqual([sasu[0]]);
        expect(sensesSharing(sasu, ['glitter'])).toEqual(sasu);
    });
});

describe('sharedSenseType', () => {
    it('reads 差す as an intransitive verb in the shine group', () => {
        expect(sharedSenseType(sasu, ['shine'])).toEqual(['verb', 'intransitive']);
    });

    it('reads 都合 as a noun in the state group, not as its transitive sense', () => {
        expect(sharedSenseType(tsugou, ['circumstances', 'condition'])).toEqual(['noun']);
    });

    it('names no transitivity when the senses have both', () => {
        expect(sharedSenseType(sasu, [])).toEqual(['verb']);
    });
});

describe('markedGlosses', () => {
    it('marks the glosses the group shares, after the dataset normalisation', () => {
        expect(markedGlosses(sasu.slice(0, 1), ['shine'])).toEqual([{ gloss: 'to shine', shared: true }, { gloss: 'to be visible', shared: false }]);
    });
});

describe('exampleForMeanings', () => {
    const sentence = (id: string, en: string): Sentence => ({ id, original: id, en: [{ id: `${id}-en`, text: en }], vocabIds: ['sasu'] });
    const appear = sentence('kage', 'Speak of the devil and he appears.');
    const sun = sentence('hi', 'The sun shines into the room.');

    it('prefers a sentence whose English uses a shared meaning', () => {
        expect(exampleForMeanings('sasu', [appear, sun], ['shine'], new Map())?.id).toBe('hi');
    });

    it('falls back to the ranker\'s usual pick when none does', () => {
        expect(exampleForMeanings('sasu', [appear], ['shine'], new Map())?.id).toBe('kage');
        expect(exampleForMeanings('sasu', [], ['shine'], new Map())).toBeNull();
    });
});
