import { describe, it, expect } from 'vitest';
import { pickProductionClozeSentence, splitSentenceAtBlank, splitClozeContext, emphasizeGloss } from './productionCloze.utils';
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

describe('splitClozeContext', () => {
    // Real dataset shape: 貧しい人とはほんのわずかしか持っていない人ではなく欲のありすぎる人である。
    // blanking 欲 (start 25, length 1), matches for 貧しい/持っていない/欲/人(×3).
    const sentence = makeSentence({
        id: 's1',
        original: '貧しい人とはほんのわずかしか持っていない人ではなく欲のありすぎる人である。',
        matches: {
            '1490740': [{ start: 0, length: 3, reading: 'まずしい' }],   // 貧しい (before)
            '1315720': [{ start: 14, length: 6, reading: 'もっていない' }], // 持っていない (before)
            '1547320': [{ start: 25, length: 1, reading: 'よく' }],        // 欲 (the blank)
            '1580640': [                                                   // 人 ×3
                { start: 3, length: 1, reading: 'ひと' },   // before
                { start: 20, length: 1, reading: 'ひと' },  // before
                { start: 32, length: 1, reading: 'ひと' },  // after
            ],
        },
    });
    const cloze = { sentence, blankStart: 25, blankLength: 1 };

    it('rejoins before + blank + after back into the original sentence', () => {
        const { before, after } = splitClozeContext(cloze);
        expect(before.original + '欲' + after.original).toBe(sentence.original);
    });

    it('drops the blanked target span from both fragments', () => {
        const { before, after } = splitClozeContext(cloze);
        expect(before.matches?.['1547320']).toBeUndefined();
        expect(after.matches?.['1547320']).toBeUndefined();
    });

    it('keeps before-side matches at their original offsets', () => {
        const { before } = splitClozeContext(cloze);
        expect(before.matches?.['1490740']).toEqual([{ start: 0, length: 3, reading: 'まずしい' }]);
        expect(before.matches?.['1315720']).toEqual([{ start: 14, length: 6, reading: 'もっていない' }]);
        // Only the two before-side occurrences of 人, not the after-side one.
        expect(before.matches?.['1580640']).toEqual([
            { start: 3, length: 1, reading: 'ひと' },
            { start: 20, length: 1, reading: 'ひと' },
        ]);
    });

    it('rebases after-side match offsets to the after fragment', () => {
        const { after } = splitClozeContext(cloze);
        // 人 at 32 in the full sentence -> 32 - 26 = 6 in "のありすぎる人である。".
        expect(after.matches?.['1580640']).toEqual([{ start: 6, length: 1, reading: 'ひと' }]);
        expect(after.original[6]).toBe('人');
    });

    it('drops a match that straddles the blank boundary', () => {
        const straddling = makeSentence({
            original: 'abcde',
            matches: { v1: [{ start: 1, length: 3 }] }, // spans [1,4), blank is [2,3)
        });
        const { before, after } = splitClozeContext({ sentence: straddling, blankStart: 2, blankLength: 1 });
        expect(before.matches?.['v1']).toBeUndefined();
        expect(after.matches?.['v1']).toBeUndefined();
    });
});

describe('emphasizeGloss', () => {
    it('bolds the matching gloss in the English sentence, preserving surrounding text', () => {
        const text = 'Poor is not the one who has too little, but the one who wants too much.';
        const r = emphasizeGloss(text, ['greed', 'craving', 'desire', 'wants']);
        expect(r.inline).not.toBeNull();
        expect(r.inline!.match).toBe('wants');
        expect(r.inline!.before + r.inline!.match + r.inline!.after).toBe(text);
        expect(r.labelGlosses).toEqual([]);
    });

    it('matches case-insensitively but keeps the original casing in the match span', () => {
        const r = emphasizeGloss('Poor is not the one who has too little.', ['poor', 'needy']);
        expect(r.inline?.match).toBe('Poor');
    });

    it('prefers the longest (most specific) gloss when several appear', () => {
        const r = emphasizeGloss('He had a strong desire to win.', ['desire', 'strong desire']);
        expect(r.inline?.match).toBe('strong desire');
    });

    it('strips parentheticals and a leading "to" before matching', () => {
        const r = emphasizeGloss('She will hold the meeting.', ['to hold (a meeting)']);
        expect(r.inline?.match).toBe('hold');
    });

    it('falls back to a gloss label when no gloss appears verbatim', () => {
        const r = emphasizeGloss('He has too little.', ['to have', 'to hold', 'to possess', 'to own']);
        expect(r.inline).toBeNull();
        expect(r.labelGlosses).toEqual(['have', 'hold', 'possess']); // cleaned, first 3
    });

    it('never bolds a gloss shorter than 3 characters (avoids incidental "be"/"do")', () => {
        const r = emphasizeGloss('It is nice to be here.', ['be']);
        expect(r.inline).toBeNull();
        expect(r.labelGlosses).toEqual(['be']);
    });

    it('handles an empty English sentence by falling back to the label', () => {
        const r = emphasizeGloss('', ['greed', 'desire']);
        expect(r.inline).toBeNull();
        expect(r.labelGlosses).toEqual(['greed', 'desire']);
    });
});
