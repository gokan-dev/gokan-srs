import { describe, it, expect } from 'vitest';
import { pickProductionClozeSentence, splitSentenceAtBlank } from './productionCloze.utils';
import type { Sentence } from '../models/sentence.model';

function makeSentence(overrides: Partial<Sentence> = {}): Sentence {
    return {
        id: 's1',
        original: '彼は必ず来る。',
        en: [{ id: 'e1', text: 'He will certainly come.' }],
        vocabIds: [],
        ...overrides,
    };
}

describe('pickProductionClozeSentence', () => {
    it('returns null when no sentence has a usable match for the vocab', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: {} }),
            makeSentence({ id: 's2', matches: { other: [{ start: 0, length: 1 }] } }),
        ];
        expect(pickProductionClozeSentence('v1', sentences, 0)).toBeNull();
    });

    it('returns null for an empty sentence list', () => {
        expect(pickProductionClozeSentence('v1', [], 0)).toBeNull();
    });

    it('ignores sentences with an empty match array for the vocab', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: { v1: [] } }),
            makeSentence({ id: 's2', matches: { v1: [{ start: 1, length: 2 }] } }),
        ];
        const plan = pickProductionClozeSentence('v1', sentences, 0);
        expect(plan?.sentence.id).toBe('s2');
    });

    it('picks the first occurrence when the word appears more than once', () => {
        const sentences = [
            makeSentence({
                id: 's1',
                original: '必ず来る。必ず来る。',
                matches: { v1: [{ start: 0, length: 3 }, { start: 5, length: 3 }] },
            }),
        ];
        const plan = pickProductionClozeSentence('v1', sentences, 0);
        expect(plan).toEqual({ sentence: sentences[0], blankStart: 0, blankLength: 3 });
    });

    it('is deterministic for a fixed vocabId:reviewCount pair', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: { v1: [{ start: 0, length: 1 }] } }),
            makeSentence({ id: 's2', matches: { v1: [{ start: 0, length: 1 }] } }),
            makeSentence({ id: 's3', matches: { v1: [{ start: 0, length: 1 }] } }),
        ];
        const first = pickProductionClozeSentence('v1', sentences, 3);
        const second = pickProductionClozeSentence('v1', sentences, 3);
        expect(first).toEqual(second);
    });

    it('cycles through different usable sentences as reviewCount increases', () => {
        const sentences = Array.from({ length: 5 }, (_, i) =>
            makeSentence({ id: `s${i}`, matches: { v1: [{ start: 0, length: 1 }] } })
        );

        const picks = new Set(
            Array.from({ length: 5 }, (_, reviewCount) =>
                pickProductionClozeSentence('v1', sentences, reviewCount)?.sentence.id
            )
        );

        // Not every reviewCount needs to land on a distinct sentence, but across
        // 5 reviews of a 5-sentence pool it shouldn't pin to just one.
        expect(picks.size).toBeGreaterThan(1);
    });

    it('only considers the target vocabId, not other vocab matched in the same sentence', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: { other: [{ start: 0, length: 1 }] } }),
        ];
        expect(pickProductionClozeSentence('v1', sentences, 0)).toBeNull();
    });
});

describe('splitSentenceAtBlank', () => {
    it('reproduces the original sentence exactly when rejoined', () => {
        const sentence = makeSentence({ original: '彼は必ず来る。' });
        const cloze = { sentence, blankStart: 2, blankLength: 3 };

        const { before, blank, after } = splitSentenceAtBlank(cloze);
        expect(before + blank + after).toBe(sentence.original);
        expect(blank).toBe('必ず来');
    });

    it('handles a blank at the very start of the sentence', () => {
        const sentence = makeSentence({ original: '必ず来る。' });
        const cloze = { sentence, blankStart: 0, blankLength: 2 };

        const { before, blank, after } = splitSentenceAtBlank(cloze);
        expect(before).toBe('');
        expect(blank).toBe('必ず');
        expect(before + blank + after).toBe(sentence.original);
    });

    it('handles a blank at the very end of the sentence', () => {
        const sentence = makeSentence({ original: '彼は必ず' });
        const cloze = { sentence, blankStart: 2, blankLength: 2 };

        const { before, blank, after } = splitSentenceAtBlank(cloze);
        expect(after).toBe('');
        expect(before + blank + after).toBe(sentence.original);
    });

    it('handles a single-character blank', () => {
        const sentence = makeSentence({ original: 'abc' });
        const cloze = { sentence, blankStart: 1, blankLength: 1 };

        const { before, blank, after } = splitSentenceAtBlank(cloze);
        expect(before).toBe('a');
        expect(blank).toBe('b');
        expect(after).toBe('c');
    });
});
