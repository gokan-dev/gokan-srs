import { describe, expect, it } from 'vitest';
import { indexLearnerVocab } from '../../utils/sentenceRanking';
import { resolveCardSentences } from '../../context/quiz/cardSentences';
import { submittedAnswers } from '../../context/quiz/useExerciseTurn';
import { sentence, vocabulary } from '../../test/fixtures';
import { vocabExercise } from './builders';
import { gradeExercise } from './grading';
import type { Exercise } from './types';

const sensei = vocabulary({
    id: 'v1',
    writtenForm: { kanji: '先生', alternatives: [], containedKanji: ['先', '生'] },
    reading: { primary: 'せんせい', alternatives: [] },
});

/** A sentence with 先生 matched, heard when it has a clip. */
const withSensei = (id: string, original: string, clip?: string) => sentence({
    id,
    original,
    en: [{ id: 'en', text: 'The teacher is kind.' }],
    matches: { v1: [{ start: original.indexOf('先生'), length: 2, reading: 'せんせい' }] },
    ...(clip ? { audio: { clip } } : {}),
});

const listening = { quizType: 'reading', quizMode: 'listening' } as const;

/** The card a listening reading review loads as, from the word's sentences (the loader's own two steps). */
function listeningCard(sentences: ReturnType<typeof sentence>[]): Exercise {
    const { sentence: shown, cloze } = resolveCardSentences('v1', sensei, listening, false, sentences, indexLearnerVocab([]));
    return vocabExercise(sensei, listening, { sentence: shown, cloze });
}

describe('vocabExercise, the listening cloze (issue #165)', () => {
    it('serves a word with a sentence that has a clip as a listening cloze on that sentence', () => {
        // The shorter sentence would win the ranking, but it cannot be heard.
        const exercise = listeningCard([withSensei('quiet', '先生だ。'), withSensei('heard', '先生はとても優しい人です。', 'c0ffee')]);
        expect(exercise.kind).toBe('listening-cloze');
        if (exercise.kind !== 'listening-cloze') return;
        expect(exercise.audio).toEqual({ clip: 'c0ffee' });
        expect(exercise.cloze.sentence.id).toBe('heard');
        expect(exercise.host).toEqual({ kind: 'vocab', vocabId: 'v1', quizType: 'reading', quizMode: 'listening' });
        // No English before the answer, so nothing for a near-synonym to be judged against.
        expect(exercise.cue).toEqual({});
        expect(exercise.slots[0].word?.candidates).toEqual([]);
    });

    it('serves a word with no sentence that has a clip as the reading card, an ordinary reading review', () => {
        for (const sentences of [[withSensei('quiet', '先生だ。')], []]) {
            const exercise = listeningCard(sentences);
            expect(exercise.kind).toBe('reading');
            expect(exercise.host).toEqual({ kind: 'vocab', vocabId: 'v1', quizType: 'reading', quizMode: 'base' });
        }
    });

    it('accepts the word heard in kana, as romaji and as written, and nothing else', () => {
        const exercise = listeningCard([withSensei('heard', '先生はとても優しい人です。', 'c0ffee')]);
        const gradeOf = (typed: string) => gradeExercise(exercise, submittedAnswers(exercise, [typed], true), [0]).overall;
        expect(gradeOf('せんせい')).toBe('correct');
        expect(gradeOf('sensei')).toBe('correct');
        expect(gradeOf('先生')).toBe('correct');
        expect(gradeOf('がくせい')).toBe('wrong');
        expect(gradeOf('学生')).toBe('wrong');
    });

    it('waits on its feedback even when strictly right: the sentence is read and translated there', () => {
        const exercise = listeningCard([withSensei('heard', '先生はとても優しい人です。', 'c0ffee')]);
        expect(gradeExercise(exercise, ['せんせい'], [0]).autoAdvance).toBe(false);
    });

    it('accepts the inflected form the sentence says, as the production cloze does', () => {
        const taberu = vocabulary({
            id: 'v2',
            writtenForm: { kanji: '食べる', alternatives: [], containedKanji: ['食'] },
            reading: { primary: 'たべる', alternatives: [] },
            senses: [{ pos: ['v1', 'vt'], glosses: ['to eat'], misc: { rawTags: [] }, related: { compounds: [] } }],
        });
        const heard = sentence({ id: 's', original: '野菜を食べた。', matches: { v2: [{ start: 3, length: 3, reading: 'たべた' }] }, audio: { clip: 'beef' } });
        const { cloze } = resolveCardSentences('v2', taberu, listening, false, [heard], indexLearnerVocab([]));
        const exercise = vocabExercise(taberu, listening, { sentence: null, cloze });
        expect(exercise.kind).toBe('listening-cloze');
        for (const typed of ['たべた', '食べた', 'たべる', '食べる']) {
            expect(gradeExercise(exercise, [typed], [0]).overall).toBe('correct');
        }
    });
});
