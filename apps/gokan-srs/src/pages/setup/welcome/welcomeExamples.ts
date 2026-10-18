import type { KanjiOrderId } from "@gokan/dataset-schema";

/** The orders the welcome page's step one offers as chips, in the order they show. */
export const WELCOME_ORDER_IDS = ["kklc", "rtk", "kanjiInContext", "kanjiKana", "jlpt", "frequency"] as const satisfies readonly KanjiOrderId[];

export type WelcomeOrderId = typeof WELCOME_ORDER_IDS[number];

/** One kanji of an example word, and where the order teaches it (1 = first). */
interface ExampleKanji {
    character: string;
    position: number;
}

/**
 * The word "How it works" carries through its three steps for one order: a common two-kanji
 * word whose later kanji comes within the first 300 of that order, and one of its own example
 * sentences. Real dataset values, checked against the compiled files by welcomeExamples.test.ts.
 */
export interface WelcomeExample {
    /** How step one names the order in running text: "Say you're 300 kanji into {inText}." */
    inText: string;
    vocabId: string;
    word: string;
    kana: string;
    gloss: string;
    kanji: readonly [ExampleKanji, ExampleKanji];
    /** The sentence, split around the word. */
    before: string;
    after: string;
    en: string;
    /** Step three's demo card is right when the answer contains one of these; the first prefills it. */
    accept: readonly [string, ...string[]];
}

export const WELCOME_EXAMPLES: Record<WelcomeOrderId, WelcomeExample> = {
    kklc: {
        inText: "KKLC", vocabId: "1531710", word: "名前", kana: "なまえ", gloss: "name",
        kanji: [{ character: "名", position: 269 }, { character: "前", position: 113 }],
        before: "この川の", after: "は何？", en: "What's the name of this river?",
        accept: ["name"],
    },
    rtk: {
        inText: "Remembering the Kanji", vocabId: "1211510", word: "完全", kana: "かんぜん", gloss: "complete, perfect",
        kanji: [{ character: "完", position: 199 }, { character: "全", position: 281 }],
        before: "", after: "に忘れてたよ。", en: "I completely forgot it.",
        accept: ["complete", "perfect", "entire", "total", "full"],
    },
    kanjiInContext: {
        inText: "Kanji in Context", vocabId: "1304970", word: "仕事", kana: "しごと", gloss: "work, job",
        kanji: [{ character: "仕", position: 236 }, { character: "事", position: 237 }],
        before: "彼は", after: "を変えた。", en: "He changed his job.",
        accept: ["work", "job", "labor", "labour", "occupation", "employment"],
    },
    kanjiKana: {
        inText: "the school-grade order", vocabId: "1378860", word: "生活", kana: "せいかつ", gloss: "life, living",
        kanji: [{ character: "生", position: 44 }, { character: "活", position: 237 }],
        before: "この", after: "に疲れた。", en: "I'm tired of living this life.",
        accept: ["life", "living", "lifestyle"],
    },
    jlpt: {
        inText: "the JLPT order", vocabId: "1293990", word: "最初", kana: "さいしょ", gloss: "beginning, first",
        kanji: [{ character: "最", position: 267 }, { character: "初", position: 293 }],
        before: "", after: "から始めよう。", en: "Let's begin at the beginning.",
        accept: ["beginning", "first", "start", "outset"],
    },
    frequency: {
        inText: "the frequency order", vocabId: "1487660", word: "必要", kana: "ひつよう", gloss: "necessary, needed",
        kanji: [{ character: "必", position: 265 }, { character: "要", position: 106 }],
        before: "敷金は", after: "ですか。", en: "Do you require a security deposit?",
        accept: ["necessary", "need", "essential", "required", "requisite"],
    },
};

/** Whether the demo card takes an answer: it contains an accepted one, ignoring case. A marketing demo, not the grader. */
export function demoAnswerIsRight(example: Pick<WelcomeExample, "accept">, answer: string): boolean {
    const typed = answer.trim().toLowerCase();
    return example.accept.some(accepted => typed.includes(accepted));
}

/** The why-section demo's kanji tiles, and the two it starts with known. */
export const DEMO_TILES = ["日", "本", "人", "大", "学", "生", "先"] as const;
export const DEMO_START_KNOWN: readonly string[] = ["日", "本"];

/** The words the why-section demo brings into focus, each made only of the tiles' kanji. */
export const DEMO_WORDS: readonly { vocabId: string; word: string; kana: string; gloss: string }[] = [
    { vocabId: "1582710", word: "日本", kana: "にほん", gloss: "Japan" },
    { vocabId: "1464700", word: "日本人", kana: "にほんじん", gloss: "Japanese person" },
    { vocabId: "1368370", word: "人生", kana: "じんせい", gloss: "life" },
    { vocabId: "1413240", word: "大学", kana: "だいがく", gloss: "university" },
    { vocabId: "1206900", word: "学生", kana: "がくせい", gloss: "student" },
    { vocabId: "1413260", word: "大学生", kana: "だいがくせい", gloss: "university student" },
    { vocabId: "1387990", word: "先生", kana: "せんせい", gloss: "teacher" },
    { vocabId: "1388300", word: "先日", kana: "せんじつ", gloss: "the other day" },
];
