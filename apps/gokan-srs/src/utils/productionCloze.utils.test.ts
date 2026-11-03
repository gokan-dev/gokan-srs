import { describe, it, expect } from 'vitest';
import { pickProductionClozeSentence, emphasizeGloss, blankSurfaceOf } from './productionCloze.utils';
import type { Sentence } from '@gokan/dataset-schema';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import { indexLearnerVocab } from './sentenceRanking';
import { vocabulary } from '../test/fixtures';

const noLearner = indexLearnerVocab([]);

function makeSentence(overrides: Partial<Sentence> = {}): Sentence {
    return {
        id: 's1',
        original: '彼は必ず来る。',
        en: [{ id: 'e1', text: 'He will certainly come.' }],
        vocabIds: [],
        ...overrides,
    };
}

describe('conjugated blank forms (issue #95)', () => {
    const sentence = makeSentence({
        id: 's1',
        original: '野菜を食べたら？',
        matches: { v1: [{ start: 3, length: 4, reading: 'たべたら' }] },
    });

    it('carries the blank\'s own reading from its match', () => {
        const cloze = pickProductionClozeSentence('v1', [sentence], noLearner)!;
        expect(cloze.blankReading).toBe('たべたら');
        expect(blankSurfaceOf(cloze)).toBe('食べたら');
    });


    it('omits blankReading when the match has none', () => {
        const bare = makeSentence({ id: 's2', original: '食べた', matches: { v1: [{ start: 0, length: 3 }] } });
        const cloze = pickProductionClozeSentence('v1', [bare], noLearner)!;
        expect(cloze.blankReading).toBeUndefined();
    });
});

describe('pickProductionClozeSentence', () => {
    it('returns null when no sentence has a usable match for the vocab', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: {} }),
            makeSentence({ id: 's2', matches: { other: [{ start: 0, length: 1 }] } }),
        ];
        expect(pickProductionClozeSentence('v1', sentences, noLearner)).toBeNull();
    });

    it('returns null for an empty sentence list', () => {
        expect(pickProductionClozeSentence('v1', [], noLearner)).toBeNull();
    });

    it('ignores sentences with an empty match array for the vocab', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: { v1: [] } }),
            makeSentence({ id: 's2', matches: { v1: [{ start: 1, length: 2 }] } }),
        ];
        const plan = pickProductionClozeSentence('v1', sentences, noLearner);
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
        const plan = pickProductionClozeSentence('v1', sentences, noLearner);
        expect(plan).toEqual({ sentence: sentences[0], blankStart: 0, blankLength: 3 });
    });

    it('is deterministic: the same learner state always picks the same sentence', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: { v1: [{ start: 0, length: 1 }] } }),
            makeSentence({ id: 's2', matches: { v1: [{ start: 0, length: 1 }] } }),
            makeSentence({ id: 's3', matches: { v1: [{ start: 0, length: 1 }] } }),
        ];
        const first = pickProductionClozeSentence('v1', sentences, noLearner);
        const second = pickProductionClozeSentence('v1', sentences, noLearner);
        expect(first).toEqual(second);
    });

    it('picks the usable sentence built most from words the learner is learning', () => {
        const learner = indexLearnerVocab([
            { ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'v1', introductionAt: new Date('2026-06-01') },
            { ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'known', introductionAt: new Date('2026-06-01') },
        ]);
        const sentences = [
            makeSentence({ id: 'strangers', vocabIds: ['v1', 'u1', 'u2'], matches: { v1: [{ start: 0, length: 1 }] } }),
            makeSentence({ id: 'familiar', vocabIds: ['v1', 'known'], matches: { v1: [{ start: 0, length: 1 }] } }),
        ];
        expect(pickProductionClozeSentence('v1', sentences, learner)?.sentence.id).toBe('familiar');
    });

    it('only considers the target vocabId, not other vocab matched in the same sentence', () => {
        const sentences = [
            makeSentence({ id: 's1', matches: { other: [{ start: 0, length: 1 }] } }),
        ];
        expect(pickProductionClozeSentence('v1', sentences, noLearner)).toBeNull();
    });

    // The reported production-quiz bug: the dataset keys matches by written form,
    // so the rare 荒ぶ (すさぶ) entry claimed a 遊ぶ (あそぶ) sentence (shared kanji
    // 遊ぶ), whose cloze then blanked 遊んでる and graded it correct against a
    // "grow wild" cue. Passing the target vocab filters by reading.
    const verbSense = (gloss: string) => ({ pos: ['v5b', 'vi'], glosses: [gloss], misc: { rawTags: [] }, related: { compounds: [] } });
    const susabu = vocabulary({
        writtenForm: { kanji: '荒ぶ', alternatives: ['遊ぶ'], containedKanji: [] },
        reading: { primary: 'すさぶ', alternatives: [] },
        senses: [verbSense('to grow wild')],
    });
    const asobu = vocabulary({
        writtenForm: { kanji: '遊ぶ', alternatives: [], containedKanji: [] },
        reading: { primary: 'あそぶ', alternatives: [] },
        senses: [verbSense('to play')],
    });
    const asobuSentence = makeSentence({
        id: 'cat', original: '猫が犬と遊んでるよ。', en: [{ id: 'e', text: 'The cat is playing with the dog.' }],
        matches: { v1: [{ start: 4, length: 4, reading: 'あそんでる' }] },
    });

    it('rejects a sentence whose blanked span is read as a different homograph', () => {
        // すさぶ must not blank 遊んでる (read あそんでる) - no other sentence, so null.
        expect(pickProductionClozeSentence('v1', [asobuSentence], noLearner, susabu)).toBeNull();
    });

    it('keeps the sentence for the entry it is actually read as', () => {
        const cloze = pickProductionClozeSentence('v1', [asobuSentence], noLearner, asobu);
        expect(cloze?.sentence.id).toBe('cat');
        expect(blankSurfaceOf(cloze!)).toBe('遊んでる');
    });

    it('skips the guard when no target vocab is supplied (legacy selection-logic path)', () => {
        expect(pickProductionClozeSentence('v1', [asobuSentence], noLearner)?.sentence.id).toBe('cat');
    });
});

describe('pickProductionClozeSentence: the word as written (PR #195 staging review)', () => {
    const numeral = (kanji: string, reading: string) => vocabulary({
        writtenForm: { kanji, alternatives: [], containedKanji: [...kanji] },
        reading: { primary: reading, alternatives: [] },
    });
    const san = numeral('三', 'さん');
    const juugo = numeral('十五', 'じゅうご');

    it('rejects a span that writes the word as a digit: ３ is not 三 in use', () => {
        const digit = makeSentence({ id: 'digit', original: '３ドルです。', matches: { v1: [{ start: 0, length: 1, reading: 'さん' }] } });
        expect(pickProductionClozeSentence('v1', [digit], noLearner, san)).toBeNull();
        const written = makeSentence({ id: 'kanji', original: '三人です。', matches: { v1: [{ start: 0, length: 1, reading: 'さん' }] } });
        expect(pickProductionClozeSentence('v1', [digit, written], noLearner, san)?.sentence.id).toBe('kanji');
    });

    it('rejects a numeral inside a longer one: 十五 in 二十五, 三 in 三十', () => {
        const inside = makeSentence({ id: 'inside', original: '五の五倍は二十五', matches: { v1: [{ start: 6, length: 2, reading: 'じゅうご' }] } });
        expect(pickProductionClozeSentence('v1', [inside], noLearner, juugo)).toBeNull();
        const leading = makeSentence({ id: 'leading', original: '三十人です。', matches: { v1: [{ start: 0, length: 1, reading: 'さん' }] } });
        expect(pickProductionClozeSentence('v1', [leading], noLearner, san)).toBeNull();
        const whole = makeSentence({ id: 'whole', original: '彼は十五歳だ。', matches: { v1: [{ start: 2, length: 2, reading: 'じゅうご' }] } });
        expect(pickProductionClozeSentence('v1', [inside, whole], noLearner, juugo)?.sentence.id).toBe('whole');
    });

    it('keeps a span in kana as the word as written (conjugated: the 遊んでる case above)', () => {
        const kare = vocabulary({ writtenForm: { kanji: '彼', alternatives: [], containedKanji: ['彼'] }, reading: { primary: 'かれ', alternatives: [] } });
        const kana = makeSentence({ id: 'kana', original: 'かれは来る。', matches: { v1: [{ start: 0, length: 2, reading: 'かれ' }] } });
        expect(pickProductionClozeSentence('v1', [kana], noLearner, kare)?.sentence.id).toBe('kana');
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
