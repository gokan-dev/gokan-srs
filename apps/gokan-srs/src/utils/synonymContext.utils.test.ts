import { describe, it, expect } from 'vitest';
import {
    glossPromptGlosses, normalizeGloss, orderSynonymsForCue, productionCueOf,
    sharedMeaningInCue, sharedMeaningUsed, synonymOutcome,
} from './synonymContext.utils';
import type { ProductionCloze } from './productionCloze.utils';

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
        expect(glossPromptGlosses(senses)).toEqual(['narrow', 'confined', 'small', 'limited', 'a', 'b']);
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

    it('reports which shared meaning the cue uses', () => {
        expect(sharedMeaningUsed(['little', 'small'], { sentence: 'Japan is a small country.' })).toBe('small');
        expect(sharedMeaningUsed(['little'], { sentence: 'Japan is a small country.' })).toBeNull();
    });
});

describe('synonymOutcome', () => {
    const inCue = { sentence: 'Japan is a small country.' };
    const outOfCue = { sentence: 'The street is narrow.' };

    it('is correct in context, whatever the out-of-context tier', () => {
        expect(synonymOutcome({ relation: 'confusable', shared: ['small'] }, inCue)).toBe('correct');
        expect(synonymOutcome({ relation: 'interchangeable', shared: ['small'] }, inCue)).toBe('correct');
    });

    it('falls back to the tier out of context', () => {
        expect(synonymOutcome({ relation: 'interchangeable', shared: ['small'] }, outOfCue)).toBe('minor_error');
        expect(synonymOutcome({ relation: 'confusable', shared: ['small'] }, outOfCue)).toBe('confusable');
    });

    it('never upgrades a curated confusable pair (必ず / 常に share "always")', () => {
        expect(synonymOutcome({ relation: 'confusable', shared: ['always'], curated: true }, { sentence: 'He is always late.' })).toBe('confusable');
        expect(synonymOutcome({ relation: 'interchangeable', shared: ['all'], curated: true }, { sentence: 'I ate it all.' })).toBe('correct');
    });

    it('treats data built before `shared` existed as out of context', () => {
        expect(synonymOutcome({ relation: 'interchangeable' }, inCue)).toBe('minor_error');
    });
});

describe('orderSynonymsForCue', () => {
    it('puts entries whose shared meaning the cue uses first, keeping order otherwise', () => {
        const entries = [
            { id: 'a', shared: ['narrow'] },
            { id: 'b', shared: ['small'] },
            { id: 'c', shared: ['tiny'] },
        ];
        expect(orderSynonymsForCue(entries, { sentence: 'Japan is a small country.' }).map(e => e.id)).toEqual(['b', 'a', 'c']);
    });
});
