// src/services/exercise/demonstratives.ts
//
// The こ/そ/あ/ど demonstratives, a closed set of six series of four. On the
// meaning card, answering one with a sibling's meaning (それ answered "this") is the
// classic confusion the paradigm exists to teach: not credited, but not penalised
// either, and answered with a note on the series. The dataset has no relation that
// says which words form a series, so the table is curated here.

/** One member of a series: its meaning as the note states it, and the English answers that name it. */
interface Member {
    word: string;
    meaning: string;
    answers: string[];
}

/** Each series in こ, そ, あ, ど order. */
const SERIES: Member[][] = [
    [
        { word: 'これ', meaning: 'this (near me)', answers: ['this', 'this one'] },
        { word: 'それ', meaning: 'that (near you)', answers: ['that', 'that one', 'it'] },
        { word: 'あれ', meaning: 'that (over there)', answers: ['that over there', 'that one over there', 'that'] },
        { word: 'どれ', meaning: 'which one', answers: ['which', 'which one'] },
    ],
    [
        { word: 'この', meaning: 'this (near me)', answers: ['this'] },
        { word: 'その', meaning: 'that (near you)', answers: ['that'] },
        { word: 'あの', meaning: 'that (over there)', answers: ['that over there', 'that'] },
        { word: 'どの', meaning: 'which', answers: ['which'] },
    ],
    [
        { word: 'ここ', meaning: 'here (near me)', answers: ['here', 'this place'] },
        { word: 'そこ', meaning: 'there (near you)', answers: ['there', 'that place'] },
        { word: 'あそこ', meaning: 'over there', answers: ['over there', 'that place over there', 'there'] },
        { word: 'どこ', meaning: 'where', answers: ['where', 'what place'] },
    ],
    [
        { word: 'こちら', meaning: 'this way (near me)', answers: ['this way', 'this direction', 'here'] },
        { word: 'そちら', meaning: 'that way (near you)', answers: ['that way', 'that direction', 'there'] },
        { word: 'あちら', meaning: 'that way (over there)', answers: ['that way over there', 'over there', 'that way', 'that direction'] },
        { word: 'どちら', meaning: 'which way', answers: ['which way', 'which direction', 'which one', 'where'] },
    ],
    [
        { word: 'こう', meaning: 'like this', answers: ['like this', 'in this way', 'this way'] },
        { word: 'そう', meaning: 'like that (near you)', answers: ['like that', 'in that way', 'that way', 'so'] },
        { word: 'ああ', meaning: 'like that (over there)', answers: ['like that', 'in that way', 'that way'] },
        { word: 'どう', meaning: 'how', answers: ['how', 'in what way'] },
    ],
    [
        { word: 'こんな', meaning: 'this kind of', answers: ['this kind of', 'this sort of', 'like this'] },
        { word: 'そんな', meaning: 'that kind of (near you)', answers: ['that kind of', 'that sort of', 'like that'] },
        { word: 'あんな', meaning: 'that kind of (over there)', answers: ['that kind of', 'that sort of', 'like that'] },
        { word: 'どんな', meaning: 'what kind of', answers: ['what kind of', 'what sort of', 'which kind of'] },
    ],
];

/** What every note ends with: the series in one line. */
export const DEMONSTRATIVE_SERIES_NOTE = 'こ = near me, そ = near you, あ = over there, ど = which.';

/** A demonstrative's place in its series, carried by its meaning slot. */
export interface DemonstrativeParadigm {
    word: string;
    meaning: string;
    /** The other three members, each with the answers that name it. */
    siblings: { word: string; answers: string[] }[];
}

/**
 * The paradigm of the word with this reading and these meaning answers, or
 * undefined when it is not a demonstrative. The reading alone is not enough: こう
 * is also 項 and 校, ああ is also the interjection 嗚呼. So the word must also carry
 * one of the member's own meanings.
 */
export function demonstrativeParadigm(reading: string, meanings: string[]): DemonstrativeParadigm | undefined {
    const own = new Set(meanings.map(m => m.toLowerCase()));
    for (const series of SERIES) {
        const member = series.find(m => m.word === reading);
        if (!member || !member.answers.some(a => own.has(a))) continue;
        return {
            word: member.word,
            meaning: member.meaning,
            siblings: series.filter(m => m !== member).map(({ word, answers }) => ({ word, answers })),
        };
    }
    return undefined;
}
