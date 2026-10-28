// Every synonym case reported against grading, graded end to end on the real compiled
// dataset: the asked word's exercise is built from its own vocab file, as a session
// builds it, and the typed answer goes through gradeExercise. A change to the dataset
// build (a threshold, the normaliser, an exclusion) that drops a case fails here; the
// same pairs are pinned in gokan-dataset's build-synonyms.test.ts.
//
// A newly reported case is added to CASES: that is what keeps leniency from regressing
// one report at a time (issue #150).
import { describe, it, expect } from 'vitest';
import { headwordOf } from '@gokan/dataset-schema';
import type { Vocabulary } from '@gokan/dataset-schema';
import { vocabExercise } from './builders';
import { gradeExercise, isNeutral } from './grading';

type Expected = 'correct' | 'minor_error' | 'neutral' | 'wrong';

interface ReportedCase {
    asked: string;
    typed: string;
    /** The vocab id of the word typed; null when no synonym is identified (or, with
     *  `notTyped`, when it must not be that word). */
    typedId: string | null;
    /** The English sentence of a cloze card; absent on the gloss card. */
    sentence?: string;
    expected: Expected | { notTyped: string };
}

const ids = {
    kanarazu: '1487400', tsuneni: '1355970', zenbu: '1396130', subete: '1595730', tabun: '1407980', osoraku: '1236650',
    ichiban: '1165970', saikou: '1293850', shibaru: '1476050', shimeru: '1436570', naraberu: '1508390', narabu: '1508380',
    tsuyoi: '1236070', joubu: '1580480', sakkyoku: '1297650', sakubun: '1297960', kiwotsukete: '1221870', kiwotsukeru: '1591990',
    semai: '1237680', chiisai: '1347750', jinbutsu: '1369070', otoko: '1419990', umeru: '1524500', yamu: '1310640',
    kotaeru: '1449540', kotae: '1449530', igai: '1155090', hoka: '1203260',
};

const CASES: ReportedCase[] = [
    { asked: ids.kanarazu, typed: '常に', typedId: ids.tsuneni, expected: 'neutral' },
    { asked: ids.zenbu, typed: '全て', typedId: ids.subete, expected: 'correct' },
    { asked: ids.tabun, typed: '恐らく', typedId: ids.osoraku, expected: 'correct' },
    { asked: ids.ichiban, typed: '最高', typedId: ids.saikou, expected: 'correct' },
    { asked: ids.saikou, typed: '一番', typedId: ids.ichiban, expected: 'correct' },
    { asked: ids.shibaru, typed: '締める', typedId: ids.shimeru, expected: 'correct' },
    { asked: ids.naraberu, typed: '並ぶ', typedId: ids.narabu, expected: 'correct' },
    { asked: ids.tsuyoi, typed: '丈夫', typedId: ids.joubu, expected: 'correct' },
    { asked: ids.sakkyoku, typed: '作文', typedId: ids.sakubun, expected: 'correct' },
    { asked: ids.kiwotsukete, typed: '気をつける', typedId: ids.kiwotsukeru, expected: 'correct' },
    { asked: ids.semai, typed: '小さい', typedId: ids.chiisai, sentence: 'Japan is a small country.', expected: 'correct' },
    { asked: ids.jinbutsu, typed: 'おとこ', typedId: ids.otoko, sentence: 'Tell me what that man is like.', expected: 'correct' },
    { asked: ids.umeru, typed: '止む', typedId: ids.yamu, sentence: 'Fill in the blanks.', expected: 'neutral' },
    { asked: ids.umeru, typed: 'つむ', typedId: null, sentence: 'Fill in the blanks.', expected: { notTyped: ids.yamu } },
    // Out of context, the auto tier decides again (issue #150): accepted, short of the word.
    { asked: ids.sakkyoku, typed: '作文', typedId: ids.sakubun, sentence: 'She set the old poem to music.', expected: 'minor_error' },
    // Issue #162 lifted "nothing accepted today is refused" for dataset pairs: a pair
    // needs a gloss both words use the same way, so 答える / 答え ("to answer" / "answer")
    // is no pair. On the verb's card its own noun is still accepted, through the verb's
    // own forms; on the noun's card the verb is now wrong.
    { asked: ids.kotaeru, typed: '答え', typedId: null, expected: 'correct' },
    { asked: ids.kotae, typed: '答える', typedId: null, expected: 'wrong' },
    // A bound-form sense still pairs when it shares 3 or more glosses that way (以外 is a suffix).
    { asked: ids.igai, typed: '他', typedId: ids.hoka, expected: 'correct' },
    { asked: ids.hoka, typed: '以外', typedId: ids.igai, expected: 'correct' },
];

// import.meta.glob rather than node:fs, which this tsconfig has no types for. Only the
// case words' files, never the whole dataset.
const files = import.meta.glob<Vocabulary>(
    '../../../dataset/compiled/vocab/{1487400,1396130,1407980,1165970,1293850,1476050,1508390,1236070,1297650,1221870,1237680,1369070,1524500,1449540,1449530,1155090,1203260}.json',
    { eager: true, import: 'default' },
);
const vocabById = new Map(Object.values(files).map(v => [v.id, v]));

/** The production exercise a session builds for the word: the gloss card, or a cloze on the given English. */
function exerciseFor(vocab: Vocabulary, sentence: string | undefined) {
    const written = headwordOf(vocab);
    const cloze = sentence === undefined ? null : {
        sentence: { id: 'case', original: written, en: [{ id: 'case-en', text: sentence }], vocabIds: [vocab.id] },
        blankStart: 0,
        blankLength: written.length,
    };
    return vocabExercise(vocab, { quizType: 'production', quizMode: 'base' }, { sentence: null, cloze });
}

describe('reported synonym cases, on the compiled dataset', () => {
    // Fails rather than passes when the dataset submodule is not checked out: a suite
    // that globs nothing would pass vacuously.
    it('loads every case word\'s file', () => {
        expect([...new Set(CASES.map(c => c.asked))].filter(id => !vocabById.has(id))).toEqual([]);
    });

    it.each(CASES.map(c => ({ ...c, card: c.sentence ?? 'the gloss card' })))('$typed on a card for $asked ($card)', ({ asked, typed, typedId, sentence, expected }) => {
        const vocab = vocabById.get(asked);
        expect(vocab, `compiled/vocab/${asked}.json`).toBeDefined();
        if (!vocab) return;

        const grade = gradeExercise(exerciseFor(vocab, sentence), [typed], [0]);
        const [slot] = grade.slots;
        if (typeof expected === 'object') {
            expect(slot.synonym?.vocabId).not.toBe(expected.notTyped);
            return;
        }
        expect(slot.synonym?.vocabId ?? null).toBe(typedId);
        switch (expected) {
            case 'neutral':
                expect(isNeutral(slot)).toBe(true);
                break;
            case 'correct':
            case 'minor_error':
            case 'wrong':
                expect(grade.overall).toBe(expected);
                break;
        }
    });
});
