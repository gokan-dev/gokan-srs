/** One kanji, from `compiled/kanji.json` (or `kanji/{character}.json`). */
export interface Kanji {
    character: string;
    /** Its position in each learning order. */
    steps: KanjiSteps;
    /** JPDB rank of the kanji as a word on its own (学 5839, 海 722), not how often it is met. */
    frequency?: number;
    /** KANJIDIC2 newspaper rank, 1-2500: how often a reader meets the kanji. */
    newspaperFrequency?: number;
    /** English, the main sense first. */
    meanings: string[];
    readings: KanjiReadings;
    strokeCount: number;
    /** School grade: 1-6 primary school, 8 the rest of the jōyō, 9-10 jinmeiyō (names). */
    grade?: number;
    /** Absent only for 〇, which no radical classifies. */
    radical?: KanjiRadical;
    /** Visual components, as drawn: 海 is 氵 母 毋 𠂉. */
    components: string[];
}

/**
 * The kanji's position in each learning order that teaches it (1 = taught first). `jlpt` is a
 * level, 5 (N5) to 1 (N1), not a position.
 */
export interface KanjiSteps {
    kklc?: number;
    rtk?: number;
    rtkLegacy?: number;
    kanjiInContext?: number;
    kanjiKana?: number;
    henshall?: number;
    essentialKanji?: number;
    kanjiFlashcards?: number;
    tuttleCards?: number;
    maniette?: number;
    jlpt?: number;
    /** Reserved, unused. */
    frequency?: number;
}

/**
 * KANJIDIC2 notation: in a kun reading "." marks where the okurigana starts (まな.ぶ is 学ぶ), and a
 * leading or trailing "-" a suffix or prefix reading.
 */
export interface KanjiReadings {
    /** Katakana. */
    on: string[];
    /** Hiragana. */
    kun: string[];
    /** Readings used only in names. */
    nanori: string[];
}

/** The classical (Kangxi) radical, 1-214, and the character it is written with. */
export interface KanjiRadical {
    number: number;
    character: string;
}

/** A book that numbers the kanji in the order it teaches them. */
export type KanjiBook = Exclude<keyof KanjiSteps, 'jlpt' | 'frequency'>;

/** Each book's name, as a learner knows it. */
export const KANJI_BOOKS: Record<KanjiBook, string> = {
    kklc: 'Kodansha Kanji Learner\'s Course',
    rtk: 'Remembering the Kanji',
    rtkLegacy: 'Remembering the Kanji, 1st-5th editions',
    kanjiInContext: 'Kanji in Context',
    kanjiKana: 'Kanji & Kana',
    henshall: 'A Guide to Remembering Japanese Characters',
    essentialKanji: 'Essential Kanji',
    kanjiFlashcards: 'Japanese Kanji Flashcards',
    tuttleCards: 'Tuttle Kanji Cards',
    maniette: 'Les Kanjis dans la tête',
};

/**
 * An order a learner can follow, one `index/kanji-orders/{id}.json` each. Every book but Essential
 * Kanji, whose numbering skips positions, plus two derived orders.
 */
export type KanjiOrderId = Exclude<KanjiBook, 'essentialKanji'> | 'jlpt' | 'frequency';

export interface KanjiOrder {
    id: KanjiOrderId;
    /** Short, for a picker and a label: "RTK". */
    label: string;
    description: string;
    /**
     * How a sentence naming every order says this one ("Remembering the Kanji in any edition").
     * Orders a learner thinks of as one share it, and `supportedOrdersList` says it once.
     */
    listName: string;
    /**
     * How a learner names the order in a search, for the dictionary's page titles ("KKLC
     * vocabulary list"): the label, unless it would not say it alone (a derived order is not a
     * book, RTK's older editions are searched by edition).
     */
    searchName: string;
}

/** Every order, the most followed first: a Record, so adding an order fails until it is described. */
const RTK_LIST_NAME = 'Remembering the Kanji in any edition';
const DERIVED_LIST_NAME = 'JLPT and frequency order';
const CARDS_LIST_NAME = 'the White Rabbit and Tuttle cards';

const ORDER_INFO: Record<KanjiOrderId, Omit<KanjiOrder, 'id'>> = {
    kklc: { label: 'KKLC', description: 'Kodansha Kanji Learner\'s Course', listName: 'KKLC', searchName: 'KKLC' },
    rtk: { label: 'RTK', description: 'Remembering the Kanji, 6th edition (books 1 and 3)', listName: RTK_LIST_NAME, searchName: 'RTK' },
    jlpt: { label: 'JLPT', description: 'N5 first, the most common kanji first within a level', listName: DERIVED_LIST_NAME, searchName: 'JLPT kanji order' },
    frequency: { label: 'Frequency', description: 'The kanji met most often in print first', listName: DERIVED_LIST_NAME, searchName: 'Kanji frequency order' },
    kanjiKana: { label: 'Kanji & Kana', description: 'The jōyō in the order Japanese schools teach it (Hadamitzky)', listName: 'Kanji & Kana (the school-grade order)', searchName: 'Kanji & Kana' },
    kanjiInContext: { label: 'Kanji in Context', description: 'Nishiguchi and Kono', listName: 'Kanji in Context', searchName: 'Kanji in Context' },
    rtkLegacy: { label: 'RTK, older editions', description: 'Remembering the Kanji, 1st to 5th editions', listName: RTK_LIST_NAME, searchName: 'RTK 1st to 5th edition' },
    henshall: { label: 'Henshall', description: 'A Guide to Remembering Japanese Characters', listName: 'Henshall', searchName: 'Henshall' },
    kanjiFlashcards: { label: 'White Rabbit cards', description: 'Japanese Kanji Flashcards (White Rabbit Press)', listName: CARDS_LIST_NAME, searchName: 'White Rabbit kanji cards' },
    tuttleCards: { label: 'Tuttle cards', description: 'Tuttle Kanji Cards', listName: CARDS_LIST_NAME, searchName: 'Tuttle kanji cards' },
    maniette: { label: 'Maniette', description: 'Les Kanjis dans la tête, the French RTK', listName: 'Les Kanjis dans la tête', searchName: 'Les Kanjis dans la tête' },
};

/** The orders a learner can pick, the most followed first. */
export const KANJI_ORDERS: readonly KanjiOrder[] = (Object.keys(ORDER_INFO) as KanjiOrderId[]).map(id => ({ id, ...ORDER_INFO[id] }));

/**
 * Every order a learner can follow, as one English list in `KANJI_ORDERS` order, each `listName`
 * said once where it first appears: "KKLC, ..., and Les Kanjis dans la tête".
 */
export function supportedOrdersList(): string {
    const names = [...new Set(KANJI_ORDERS.map(order => order.listName))];
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function kanjiOrder(id: KanjiOrderId): KanjiOrder {
    return { id, ...ORDER_INFO[id] };
}

export function isKanjiOrderId(value: unknown): value is KanjiOrderId {
    return typeof value === 'string' && Object.hasOwn(ORDER_INFO, value);
}

/** The books that teach this kanji and its position in each, in `KANJI_BOOKS` order. */
export function kanjiBookPositions(kanji: Pick<Kanji, 'steps'>): { book: KanjiBook; name: string; position: number }[] {
    return (Object.keys(KANJI_BOOKS) as KanjiBook[]).flatMap(book => {
        const position = kanji.steps[book];
        return position === undefined ? [] : [{ book, name: KANJI_BOOKS[book], position }];
    });
}

/** Where a school grade puts the kanji: "Grade 2", "Jōyō, secondary school", "Jinmeiyō (names)". */
export function kanjiGradeLabel(grade: number): string {
    if (grade <= 6) return `Grade ${grade}`;
    if (grade === 8) return 'Jōyō, secondary school';
    return 'Jinmeiyō (names)';
}

/**
 * A kun reading as both apps show it: the okurigana in parentheses, まな.ぶ as まな(ぶ) (学ぶ), a
 * prefix or suffix dash kept. Parentheses, not a colour: the colours already mean something else
 * (DESIGN_SYSTEM.md, Colour), and the cue must survive copy-paste and a screen reader.
 */
export function kunReadingLabel(reading: string): string {
    const dot = reading.indexOf('.');
    return dot === -1 ? reading : `${reading.slice(0, dot)}(${reading.slice(dot + 1)})`;
}
