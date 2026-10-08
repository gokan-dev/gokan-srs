import { describe, it, expect } from 'vitest';
import { gradeExercise, gradeSlot, supportCoefficient, SUPPORT_COEFFICIENT_FLOOR, worstOf } from './grading';
import { markerInflections, meaningSlot, readingSlot, wordSlot } from './slots';
import { vocabExercise } from './builders';
import type { AnswerSlot, GradedExercise, SynonymCandidate, WordForms } from './types';
import type { ProductionCue } from '../../utils/synonymContext.utils';
import type { AnswerResult } from '../../utils/answerMatching';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import type { Vocabulary } from '@gokan/dataset-schema';
import { inferredWord } from '../../utils/inflection.utils';
import { answerSlot, vocabulary } from '../../test/fixtures';

const grade = (slot: AnswerSlot, input: string, cue: ProductionCue = {}) => gradeSlot(slot, input, 0, cue);

/** A production slot for `vocab`, the way the production card builds it. */
const production = (vocab: WordForms, synonyms: SynonymCandidate[] = []) =>
    wordSlot(vocab, { vocabId: 'target', otherForm: 'correct', role: 'core', synonyms });

const taberu: WordForms = {
    reading: { primary: 'たべる', alternatives: [] },
    writtenForm: { kanji: '食べる', alternatives: [], containedKanji: ['食'] },
    senses: [{ pos: ['v1', 'vt'], glosses: ['to eat'], misc: { rawTags: [] }, related: { compounds: [] } }],
};

const kanarazu: WordForms = {
    reading: { primary: 'かならず', alternatives: [] },
    writtenForm: { kanji: '必ず', alternatives: ['必らず'], containedKanji: ['必'] },
};

function candidate(vocabId: string, relation: SynonymCandidate['relation'], kanji: string, reading: string, extra: Partial<SynonymCandidate> = {}): SynonymCandidate {
    return {
        vocabId, relation,
        vocab: { reading: { primary: reading, alternatives: [] }, writtenForm: { kanji, alternatives: [], containedKanji: [] } },
        ...extra,
    };
}

describe('the reading slot (alternatives)', () => {
    const slot = readingSlot({ reading: { primary: 'main', alternatives: ['alt', 'other'] } });

    it('matches the primary and an alternative', () => {
        expect(grade(slot, 'main')).toEqual({ result: 'correct', shown: 'main' });
        expect(grade(slot, 'alt')).toEqual({ result: 'correct', shown: 'alt' });
    });

    it('prefers an exact alternative over a typo of the primary', () => {
        const ambiguous = readingSlot({ reading: { primary: 'main', alternatives: ['man'] } });
        expect(grade(ambiguous, 'man')).toEqual({ result: 'correct', shown: 'man' });
    });

    it('reports a typo against the form it is close to', () => {
        expect(grade(slot, 'mein')).toEqual({ result: 'minor_error', shown: 'main' });
    });

    it('accepts only readings: the written form is what is being read', () => {
        const nihon = vocabExercise(vocabulary(), { quizType: 'reading', quizMode: 'base' }, { sentence: null, cloze: null });
        expect(gradeExercise(nihon, ['日本'], [0]).overall).toBe('wrong');
    });
});

describe('the meaning slot', () => {
    const slot = meaningSlot(['to eat', 'to consume']);

    it('matches any gloss, case and punctuation aside', () => {
        expect(grade(slot, 'to eat')).toEqual({ result: 'correct', shown: 'to eat' });
        expect(grade(slot, 'To Eat!').result).toBe('correct');
        expect(grade(slot, 'to consume')).toEqual({ result: 'correct', shown: 'to consume' });
    });

    it('allows minor typos and rejects other words, revealing the first gloss', () => {
        expect(grade(slot, 'to consmue')).toEqual({ result: 'minor_error', shown: 'to consume' });
        expect(grade(slot, 'drink')).toEqual({ result: 'wrong', shown: 'to eat' });
    });

    it('splits glosses on their separators, but not inside parentheses or numbers', () => {
        expect(grade(meaningSlot(['eat; consume']), 'consume').result).toBe('correct');
        expect(grade(meaningSlot(['going through (for example, night)']), 'going through')).toEqual({ result: 'correct', shown: 'going through' });
        expect(grade(meaningSlot(['dog (Canis (lupus) familiaris)']), 'dog')).toEqual({ result: 'correct', shown: 'dog' });
        expect(grade(meaningSlot(['10,000']), '10,000')).toEqual({ result: 'correct', shown: '10,000' });
    });

    it('grades a partial answer a near miss when the lengths are close', () => {
        expect(grade(meaningSlot(['painful']), 'pain').result).toBe('minor_error');
        expect(grade(meaningSlot(['pain']), 'painful').result).toBe('minor_error');
        expect(grade(meaningSlot(['uncomfortable']), 'able').result).toBe('wrong');
    });

    it('never moves on by itself: the card has glosses worth reading', () => {
        const exercise = vocabExercise(vocabulary(), { quizType: 'meaning', quizMode: 'base' }, { sentence: null, cloze: null });
        expect(gradeExercise(exercise, ['Japan'], [0]).autoAdvance).toBe(false);
    });
});

describe('a production slot: any form of the word is correct (issue #95)', () => {
    it.each(['食べたら', 'たべたら', '食べた', '食べる', 'たべて'])('grades %s correct for 食べる', input => {
        expect(grade(production(taberu), input).result).toBe('correct');
    });

    it('accepts the cloze blank surface and its reading', () => {
        const slot = wordSlot(taberu, { otherForm: 'correct', role: 'core', synonyms: [], occurrence: { surface: '食べていた', reading: 'たべていた', inflected: true } });
        expect(grade(slot, '食べていた').result).toBe('correct');
        expect(grade(slot, 'たべていた').result).toBe('correct');
    });

    it('keeps a reading typo of the dictionary form a near miss, and another word wrong', () => {
        expect(grade(production(taberu), 'たべるう').result).toBe('minor_error');
        const kaiwa: WordForms = { reading: { primary: 'かいわ', alternatives: [] }, writtenForm: { kanji: '会話', alternatives: [], containedKanji: ['会', '話'] } };
        expect(grade(production(kaiwa), '会社').result).toBe('wrong');
    });
});

describe('a production slot: readings and written forms (issue #71 Part A)', () => {
    const slot = production(kanarazu);

    it('grades the reading, the kanji and a written alternative correct', () => {
        expect(grade(slot, 'かならず')).toEqual({ result: 'correct', shown: 'かならず' });
        expect(grade(slot, '必ず')).toEqual({ result: 'correct', shown: '必ず' });
        expect(grade(slot, '必らず')).toEqual({ result: 'correct', shown: '必らず' });
    });

    it('never matches a written form by edit distance, but keeps reading typos a near miss', () => {
        expect(grade(slot, '必ぜ').result).toBe('wrong');
        expect(grade(slot, 'かなるず')).toEqual({ result: 'minor_error', shown: 'かならず' });
        expect(grade(slot, 'ねこ').result).toBe('wrong');
    });

    it('accepts a merged homograph reading and a literal "pass"', () => {
        const merged = production({ ...kanarazu, mergedVocabs: [{ id: 'x', isBase: false, originalPrimaryReading: 'かならず2', originalGlosses: [] }] });
        expect(grade(merged, 'かならず2')).toEqual({ result: 'correct', shown: 'かならず2' });
        expect(grade(slot, 'pass').result).toBe('pass');
    });

    describe('a dropped okurigana tail (reported from production)', () => {
        const mutsu = production({
            reading: { primary: 'むっつ', alternatives: ['むつ'] },
            writtenForm: { kanji: '六つ', alternatives: ['６つ'], containedKanji: ['六'] },
        });

        it('grades the kanji stem alone a near miss, the full form and reading correct', () => {
            expect(grade(mutsu, '六')).toEqual({ result: 'minor_error', shown: '六つ' });
            expect(grade(mutsu, '六つ').result).toBe('correct');
            expect(grade(mutsu, 'むっつ').result).toBe('correct');
        });

        it('does not extend the tolerance to a word with more kanji', () => {
            expect(grade(mutsu, '六月').result).toBe('wrong');
        });
    });
});

describe('parity: a production card and a grammar blank grade the same answer the same way', () => {
    // The sentence wants 食べ (to be followed by たら); the dataset stores the lemma reading on it.
    const blank = wordSlot(taberu, {
        vocabId: 'taberu', otherForm: 'minor_error', role: 'support', synonyms: [],
        occurrence: { surface: '食べ', reading: 'たべる', inflected: true },
    });
    const card = production(taberu);

    it.each([
        ['たべるう', 'a reading typo'],
        ['食', 'a dropped okurigana tail'],
        ['会社', 'another word'],
        ['pass', 'a literal pass'],
        ['', 'an empty answer'],
    ])('grades %s (%s) identically', input => {
        expect(grade(blank, input).result).toBe(grade(card, input).result);
    });

    it('grades a revealed slot identically', () => {
        expect(gradeSlot(blank, 'x', 2, {}).result).toBe(gradeSlot(card, 'x', 2, {}).result);
    });

    it.each(['食べる', 'たべる', '食べた'])('differs only where the conjugation counts: %s', input => {
        // Production tests the word; a sentence blank also tests the form it takes there.
        expect(grade(card, input).result).toBe('correct');
        expect(grade(blank, input).result).toBe('minor_error');
    });

    describe('with near-synonyms', () => {
        const kuu = candidate('kuu', 'interchangeable', '食う', 'くう', { shared: ['eat'] });
        const curated = candidate('kuu', 'interchangeable', '食う', 'くう', { curated: true });
        const blankWith = (synonyms: SynonymCandidate[]) => ({ ...blank, word: { ...blank.word!, synonyms } });

        const cases: [sentence: string, synonyms: SynonymCandidate[], expected: AnswerResult, why: string][] = [
            ['Why not eat vegetables?', [kuu], 'correct', 'a synonym the sentence means'],
            ['The vegetables are fresh.', [kuu], 'wrong', 'a synonym the sentence does not mean'],
            ['The vegetables are fresh.', [curated], 'minor_error', 'a curated pair out of context'],
        ];

        it.each(cases)('grades 食う against "%s" identically', (sentence, synonyms, expected) => {
            const onBlank = grade(blankWith(synonyms), '食う', { sentence });
            const onCard = grade(production(taberu, synonyms), '食う', { sentence });
            expect(onBlank.result).toBe(expected);
            // Each shows its own reveal; the grade and the word recognized are the same.
            expect({ result: onBlank.result, synonym: onBlank.synonym }).toEqual({ result: onCard.result, synonym: onCard.synonym });
        });
    });
});

describe('a grammar marker: the right construction in another conjugation', () => {
    const aru = inferredWord('ある', 'あり')!;
    // n5-064's blank, があります: が, then ある inflected by ます.
    const tokens = [
        { surface: 'が', kana: 'が', word: null },
        { surface: 'あり', kana: 'あり', word: aru },
        { surface: 'ます', kana: 'ます', word: null },
    ];
    const [inflection] = markerInflections(tokens, true);
    const slot = answerSlot({ accept: ['があります'], inflections: [inflection] });

    it('finds the word, the text before it and how far its inflection reaches', () => {
        expect(inflection).toEqual({ lead: ['が'], word: aru, form: ['あります'], tail: [''], registerFree: true });
    });

    it('grades the same form in the other politeness correct: the sense is the same', () => {
        expect(grade(slot, 'がある')).toEqual({ result: 'correct', shown: 'がある' });
    });

    it.each(['がありません', 'があった', 'がない', 'がありました'])('grades %s, another tense or polarity, a near miss showing the expected form', input => {
        expect(grade(slot, input)).toEqual({ result: 'minor_error', shown: 'があります' });
    });

    it('keeps politeness a near miss when the card asks for a register', () => {
        const asked = answerSlot({ accept: ['があります'], inflections: markerInflections(tokens, false) });
        expect(grade(asked, 'がある').result).toBe('minor_error');
    });

    it('keeps the rest of the construction: another particle, a missing one or another verb is wrong', () => {
        expect(grade(slot, 'ある').result).toBe('wrong');
        expect(grade(slot, 'をある').result).toBe('wrong');
        expect(grade(slot, 'がいる').result).toBe('wrong');
        expect(grade(slot, 'があります').result).toBe('correct');
    });

    it('keeps the fixed text after a word whose inflection stops short of the end (なければならない)', () => {
        const [nai, naru] = markerInflections([
            { surface: 'なけれ', kana: 'なけれ', word: inferredWord('ない', 'なけれ') },
            { surface: 'ば', kana: 'ば', word: null },
            { surface: 'なら', kana: 'なら', word: inferredWord('なる', 'なら') },
            { surface: 'ない', kana: 'ない', word: null },
        ], true);
        expect(nai).toMatchObject({ lead: [''], tail: ['ならない'] });
        expect(naru).toMatchObject({ lead: ['なければ'], tail: [''] });
        const nakereba = answerSlot({ accept: ['なければならない'], inflections: [nai, naru] });
        expect(grade(nakereba, 'なければなりません').result).toBe('correct');
        expect(grade(nakereba, 'なければならなかった').result).toBe('minor_error');
        expect(grade(nakereba, 'なければいけない').result).toBe('wrong');
    });

    it('accepts the text around the word in kana as well as written', () => {
        const [inf] = markerInflections([
            { surface: '事', kana: 'こと', word: null },
            { surface: 'に', kana: 'に', word: null },
            { surface: 'し', kana: 'し', word: inferredWord('する', 'し') },
            { surface: 'て', kana: 'て', word: null },
            { surface: 'いる', kana: 'いる', word: null },
        ], true);
        const slot2 = answerSlot({ accept: ['事にしている'], inflections: [inf] });
        expect(grade(slot2, 'ことにしています').result).toBe('correct');
        expect(grade(slot2, '事にする').result).toBe('minor_error');
        expect(grade(slot2, 'ことにした').result).toBe('minor_error');
    });
});

describe('hints and empty answers', () => {
    const slot = production(kanarazu);

    it('grades a revealed slot a near miss whatever was typed, showing its reveal', () => {
        expect(gradeSlot(slot, 'かならず', 2, {})).toEqual({ result: 'minor_error', shown: 'かならず' });
        expect(gradeSlot(slot, 'ねこ', 2, {}).result).toBe('minor_error');
    });

    it('grades an empty slot a pass: an explicit "I do not know"', () => {
        expect(grade(slot, '  ')).toEqual({ result: 'pass', shown: 'かならず' });
    });
});

describe('near-synonyms (issue #71 Part B)', () => {
    // The issue's own example: 必ず (target) and its near-synonyms.
    const kitto = candidate('kitto', 'interchangeable', 'きっと', 'きっと');
    const tsuneni = candidate('tsuneni', 'confusable', '常に', 'つねに');
    const synonymOf = (input: string, candidates: SynonymCandidate[], cue: ProductionCue = {}) =>
        grade(production(kanarazu, candidates), input, cue).synonym;

    it('identifies the typed word by its written form or reading', () => {
        expect(synonymOf('きっと', [kitto, tsuneni])?.vocabId).toBe('kitto');
        expect(synonymOf('常に', [kitto, tsuneni])?.vocabId).toBe('tsuneni');
    });

    it('identifies it by a reading typo, never by a written form one character off', () => {
        expect(synonymOf('つねい', [tsuneni])?.vocabId).toBe('tsuneni');
        expect(synonymOf('常い', [tsuneni])).toBeUndefined();
    });

    it('prefers an exact match over a typo match listed earlier (reported: つむ is 積む, not 止む)', () => {
        const yamu = candidate('yamu', 'interchangeable', '止む', 'やむ');
        const tsumu = candidate('tsumu', 'confusable', '積む', 'つむ');
        expect(synonymOf('つむ', [yamu, tsumu])?.vocabId).toBe('tsumu');
        expect(synonymOf('きっとお', [yamu, kitto])?.vocabId).toBe('kitto');
    });

    it('takes the first exact match in list order, and nothing for an unrelated answer', () => {
        const kittoKanji = candidate('kitto-2', 'confusable', '屹度', 'きっと');
        expect(synonymOf('きっと', [kitto, kittoKanji])?.vocabId).toBe('kitto');
        expect(synonymOf('ねこ', [kitto, tsuneni])).toBeUndefined();
        expect(synonymOf('つねに', [])).toBeUndefined();
    });

    it('matches a candidate by one of its conjugated forms', () => {
        const taberuCandidate: SynonymCandidate = { vocabId: 'taberu', relation: 'interchangeable', vocab: taberu };
        expect(synonymOf('食べた', [taberuCandidate])?.vocabId).toBe('taberu');
    });

    it('is only tried on a miss: an accepted answer never becomes a synonym', () => {
        expect(synonymOf('かならず', [candidate('same', 'interchangeable', '必', 'かならず')])).toBeUndefined();
    });

    it('grades by the card\'s text: correct when the cue uses a shared meaning, neutral otherwise', () => {
        const chiisai = candidate('chiisai', 'interchangeable', '小さい', 'ちいさい', { shared: ['small'] });
        const inCue = grade(production(kanarazu, [chiisai]), '小さい', { sentence: 'Japan is a small country.' });
        expect(inCue.result).toBe('correct');
        expect(inCue.synonym).toMatchObject({ outcome: 'correct', meaning: 'small', written: '小さい', label: '小さい (ちいさい)' });

        const outOfCue = grade(production(kanarazu, [chiisai]), '小さい', { sentence: 'The street is narrow.' });
        expect(outOfCue.result).toBe('wrong');
        expect(outOfCue.synonym?.outcome).toBe('confusable');
    });

    it('keeps a curated interchangeable pair a near miss out of context', () => {
        const curated = candidate('kitto', 'interchangeable', 'きっと', 'きっと', { curated: true });
        expect(grade(production(kanarazu, [curated]), 'きっと').result).toBe('minor_error');
    });
});

describe('gradeExercise', () => {
    const exercise = (slots: AnswerSlot[], cue: ProductionCue = {}): GradedExercise => ({ kind: 'grammar-cloze', slots, cue });
    const core = production(kanarazu);
    const support = { ...production(taberu), role: 'support' as const };

    it('decides the result from the core slots, the support slots only scaling the reward', () => {
        const right = gradeExercise(exercise([core, support]), ['かならず', 'ねこ'], [0, 0]);
        expect(right.overall).toBe('correct');
        expect(right.strengthModifier).toBe(SUPPORT_COEFFICIENT_FLOOR);
        expect(right.message).toBe('Grammar correct - check the highlighted word(s).');

        const wrongCore = gradeExercise(exercise([core, support]), ['ねこ', 'たべる'], [0, 0]);
        expect(wrongCore.overall).toBe('wrong');
        expect(wrongCore.strengthModifier).toBe(1);
        expect(wrongCore.message).toBe('Incorrect.');
    });

    it('takes the worst of every slot when none is core', () => {
        const fallback = gradeExercise(exercise([{ ...core, role: 'support' }, support]), ['かならず', 'たべるう'], [0, 0]);
        expect(fallback.overall).toBe('minor_error');
        expect(fallback.strengthModifier).toBe(1);
    });

    it('auto-advances only when every slot is strictly right', () => {
        expect(gradeExercise(exercise([core, support]), ['かならず', 'たべる'], [0, 0]).autoAdvance).toBe(true);
        expect(gradeExercise(exercise([core, support]), ['かならず', 'たべるう'], [0, 0]).autoAdvance).toBe(false);
        expect(gradeExercise(exercise([core]), [''], [0]).message).toBe('Revealed - marked as passed.');
    });

    describe('a near-synonym answer', () => {
        const chiisai = candidate('chiisai', 'interchangeable', '小さい', 'ちいさい', { shared: ['small'] });
        const withSynonym = production({ ...kanarazu, reading: { primary: 'せまい', alternatives: [] }, writtenForm: { kanji: '狭い', alternatives: [], containedKanji: ['狭'] } }, [chiisai]);
        const card = (cue: ProductionCue): GradedExercise => ({ kind: 'production-cloze', slots: [withSynonym], cue });

        it('names both words, and pauses instead of auto-advancing', () => {
            const inCue = gradeExercise(card({ sentence: 'Japan is a small country.' }), ['小さい'], [0]);
            expect(inCue.overall).toBe('correct');
            expect(inCue.autoAdvance).toBe(false);
            expect(inCue.message).toBe('Correct: 小さい (ちいさい) also means "small" here. The word being tested was 狭い (せまい).');
        });

        it('reads as a miss on its own when it is confusable, without counting against a support coefficient', () => {
            const outOfCue = gradeExercise(card({ sentence: 'The street is narrow.' }), ['小さい'], [0]);
            expect(outOfCue.overall).toBe('wrong');
            expect(outOfCue.message).toBe('小さい (ちいさい) is a close synonym but not interchangeable here - the word being tested was 狭い (せまい).');

            const neutralSupport = gradeExercise(
                exercise([core, { ...withSynonym, role: 'support' }], { sentence: 'The street is narrow.' }),
                ['かならず', '小さい'], [0, 0],
            );
            expect(neutralSupport.overall).toBe('correct');
            expect(neutralSupport.strengthModifier).toBe(1);
        });
    });
});

describe('the production builder', () => {
    const cloze = (en: string, original: string, blankReading?: string): ProductionCloze => ({
        sentence: { id: 's', original, en: [{ id: 'e', text: en }], vocabIds: [] },
        blankStart: 0, blankLength: original.length,
        ...(blankReading ? { blankReading } : {}),
    });

    const productionCard = (vocab: Vocabulary, sentenceCloze: ProductionCloze | null) =>
        vocabExercise(vocab, { quizType: 'production', quizMode: 'base' }, { sentence: null, cloze: sentenceCloze });

    it('serves the gloss card without a sentence and the cloze card with one', () => {
        expect(productionCard(vocabulary(), null).kind).toBe('production');
        expect(productionCard(vocabulary(), cloze('Japan.', '日本')).kind).toBe('production-cloze');
    });

    it('reveals the blank as the sentence writes it, and grades its synonyms against the sentence', () => {
        const semai = vocabulary({
            id: 'semai',
            writtenForm: { kanji: '狭い', alternatives: [], containedKanji: ['狭'] },
            reading: { primary: 'せまい', alternatives: [] },
            senses: [{ pos: ['adj-i'], misc: { rawTags: [] }, glosses: ['narrow', 'small'], related: { compounds: [] } }],
            synonyms: [{ id: 'chiisai', relation: 'interchangeable', shared: ['small'], w: ['小さい'], r: ['ちいさい'], pos: ['adj-i'] }],
        });
        const exercise = productionCard(semai, cloze('Japan is a small country.', '狭い', 'せまい'));
        expect(exercise.slots[0].reveal).toBe('狭い');
        expect(gradeExercise(exercise, ['小さかった'], [0]).slots[0].synonym?.outcome).toBe('correct');
    });
});

describe('worstOf and supportCoefficient', () => {
    it('ranks wrong below pass below a near miss below correct', () => {
        expect(worstOf(['correct', 'minor_error', 'pass'])).toBe('pass');
        expect(worstOf(['correct', 'wrong', 'pass'])).toBe('wrong');
        expect(worstOf([])).toBe('correct');
    });

    it('scales from the floor to full by the fraction answered right', () => {
        expect(supportCoefficient([])).toBe(1);
        expect(supportCoefficient(['wrong', 'correct'])).toBe(SUPPORT_COEFFICIENT_FLOOR + (1 - SUPPORT_COEFFICIENT_FLOOR) / 2);
    });
});
