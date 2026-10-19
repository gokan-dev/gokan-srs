import { describe, it, expect } from 'vitest';
import { glossPromptLines, glossSpanIn, normalizeGloss, productionCueOf, sharedMeaningInCue } from './synonymContext.utils';
import type { ProductionCloze } from './productionCloze.utils';

// The dataset's own normaliser, which the app mirrors: the two must agree byte for byte.
// import.meta.glob rather than an import, so a missing submodule fails this test rather
// than the typecheck.
const datasetBuild = Object.values(import.meta.glob<{ normalizeGloss: (gloss: string) => string }>(
    '../../dataset/scripts/build-synonyms.ts', { eager: true }
));

const cloze = (en: string): ProductionCloze => ({
    sentence: { id: 's', original: '', en: [{ id: 'e', text: en }], vocabIds: [] },
    blankStart: 0, blankLength: 1,
});

describe('productionCueOf', () => {
    it('uses the English sentence on a cloze card', () => {
        expect(productionCueOf([], cloze('Japan is a small country.'))).toEqual({ sentence: 'Japan is a small country.' });
    });

    it('uses exactly the glosses the gloss card prints', () => {
        const senses = [
            { glosses: ['narrow', 'confined', 'small'] },
            { glosses: ['limited', 'narrow-minded'] },
            { glosses: ['a'] }, { glosses: ['b'] }, { glosses: ['not shown'] },
        ];
        expect(glossPromptLines(senses)).toEqual([['narrow', 'confined', 'small'], ['limited'], ['a'], ['b']]);
        expect(productionCueOf(senses, null)).toEqual({ glosses: ['narrow', 'confined', 'small', 'limited', 'a', 'b'] });
    });
});

describe('sharedMeaningInCue', () => {
    it('finds a shared gloss used in the sentence (the two reported cases)', () => {
        expect(sharedMeaningInCue(['small'], { sentence: 'Japan is a small country.' })).toBe(true);
        expect(sharedMeaningInCue(['man'], { sentence: 'Tell me what that man is like.' })).toBe(true);
    });

    it('matches whole words only', () => {
        expect(sharedMeaningInCue(['man'], { sentence: 'The manager is here.' })).toBe(false);
        expect(sharedMeaningInCue(['small'], { sentence: 'The street is narrow.' })).toBe(false);
    });

    it('tolerates an inflected last word and matches phrases', () => {
        expect(sharedMeaningInCue(['think'], { sentence: 'She thinks so.' })).toBe(true);
        expect(sharedMeaningInCue(['line up'], { sentence: 'We lined up outside.' })).toBe(true);
        expect(sharedMeaningInCue(['study'], { sentence: 'He studied hard.' })).toBe(true);
    });

    it('compares printed glosses after the dataset normalization', () => {
        expect(normalizeGloss('To Think (about)')).toBe('think');
        expect(sharedMeaningInCue(['think'], { glosses: ['to think', 'to consider'] })).toBe(true);
        expect(sharedMeaningInCue(['believe'], { glosses: ['to think', 'to consider'] })).toBe(false);
    });

    it('is false with nothing shared', () => {
        expect(sharedMeaningInCue([], { sentence: 'anything' })).toBe(false);
    });

});

describe('normalizeGloss mirrors the dataset build', () => {
    const glosses = [
        'to think', 'To Consider.', 'the state', 'an appearance', 'State (of affairs)', 'look(s)', "don't mind",
        '  to   line up  ', 'a (short) while', 'to stop (a gap)', 'shine; glitter', 'the "best"', 'tO Be Careful!', '',
    ];
    it('finds the dataset build (the gokan-dataset submodule is checked out)', () => {
        expect(datasetBuild).toHaveLength(1);
    });
    it.each(glosses)('normalizes %j exactly as the build does', gloss => {
        expect(normalizeGloss(gloss)).toBe(datasetBuild[0]?.normalizeGloss(gloss));
    });
});

describe('glossSpanIn (the bolding and grading matcher)', () => {
    it('finds a gloss as typed, inflected, or after the normalisation', () => {
        expect(glossSpanIn('We lined up outside.', 'to line up')).toEqual({ start: 3, end: 11 });
        expect(glossSpanIn('Poor is not the one.', 'poor')).toEqual({ start: 0, end: 4 });
        expect(glossSpanIn('The manager is here.', 'man')).toBeNull();
    });
});
