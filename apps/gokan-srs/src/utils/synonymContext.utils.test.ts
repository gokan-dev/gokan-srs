import { describe, it, expect } from 'vitest';
import {
    embeddedSynonymCandidate, glossPromptGlosses, normalizeGloss, orderSynonymsForCue, productionCueOf,
    sharedMeaningInCue, sharedMeaningUsed, synonymOutcome,
} from './synonymContext.utils';
import type { ProductionCloze } from './productionCloze.utils';
import { SRSService } from '../services/srs.service';

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

    it('gives no credit out of context, whatever the automatic tier', () => {
        expect(synonymOutcome({ relation: 'interchangeable', shared: ['small'] }, outOfCue)).toBe('confusable');
        expect(synonymOutcome({ relation: 'confusable', shared: ['small'] }, outOfCue)).toBe('confusable');
    });

    // The reported case: 止む shares "stop" with 埋める ("to stop (a gap)"), but the
    // card asks for the "fill" meaning, so 止む earns nothing.
    it('gives 止む no credit on a "fill" card for 埋める', () => {
        const yamu = { relation: 'interchangeable' as const, shared: ['stop'], overlap: 0.33 };
        expect(synonymOutcome(yamu, { sentence: 'Fill in the blanks.' })).toBe('confusable');
        expect(synonymOutcome(yamu, { sentence: 'Stop the gap with cloth.' })).toBe('correct');
    });

    it('keeps a curated interchangeable pair a minor error out of context', () => {
        expect(synonymOutcome({ relation: 'interchangeable', shared: ['small'], curated: true }, outOfCue)).toBe('minor_error');
    });

    it('never upgrades a curated confusable pair (必ず / 常に share "always")', () => {
        expect(synonymOutcome({ relation: 'confusable', shared: ['always'], curated: true }, { sentence: 'He is always late.' })).toBe('confusable');
        expect(synonymOutcome({ relation: 'interchangeable', shared: ['all'], curated: true }, { sentence: 'I ate it all.' })).toBe('correct');
    });

    it('treats data built before `shared` existed as out of context', () => {
        expect(synonymOutcome({ relation: 'interchangeable' }, inCue)).toBe('confusable');
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

describe('embeddedSynonymCandidate (grading without fetching the other word)', () => {
    // 玄関's entry for 登場, as the dataset embeds it.
    const toujou = { id: '1444800', relation: 'confusable' as const, shared: ['entrance'], overlap: 0.17, w: ['登場'], r: ['とうじょう'], pos: ['vs'] };

    it('builds a candidate the production grader matches by reading or written form', () => {
        const candidate = embeddedSynonymCandidate(toujou)!;
        expect(candidate.vocab.writtenForm.kanji).toBe('登場');
        expect(candidate.vocab.reading.primary).toBe('とうじょう');
        expect(SRSService.evaluateProductionSynonyms('とうじょう', [candidate])?.candidate.vocabId).toBe('1444800');
        expect(SRSService.evaluateProductionSynonyms('登場', [candidate])).not.toBeNull();
        expect(SRSService.evaluateProductionSynonyms('げんかん', [candidate])).toBeNull();
    });

    it('carries the shared glosses and tier through, so context grading is unchanged', () => {
        const candidate = embeddedSynonymCandidate(toujou)!;
        expect(synonymOutcome(candidate, { sentence: "Let's take off our shoes at the entrance." })).toBe('correct');
        expect(synonymOutcome(candidate, { glosses: ['front door'] })).toBe('confusable');
    });

    it('keeps alternatives and the inflecting POS, so a conjugated synonym still matches', () => {
        const candidate = embeddedSynonymCandidate({ id: 'x', relation: 'interchangeable', w: ['並べる', '列べる'], r: ['ならべる'], pos: ['v1'] })!;
        expect(SRSService.evaluateProductionSynonyms('列べる', [candidate])).not.toBeNull();
        expect(SRSService.evaluateProductionSynonyms('並べた', [candidate])).not.toBeNull();
    });

    it('returns null for an entry without forms, which the caller fetches instead', () => {
        expect(embeddedSynonymCandidate({ id: 'x', relation: 'confusable', shared: ['a'] })).toBeNull();
    });
});
