/** One kanji, from `compiled/kanji.json`, with its position in each learning order. */
export interface Kanji {
    character: string;
    steps: {
        /** KKLC step number (the SRS app's primary kanji-learning order). */
        kklc?: number;
        /** JLPT level (1=N1 hardest ... 5=N5 easiest). */
        jlpt?: number;
        /** JPDB kanji frequency rank (reserved). */
        frequency?: number;
    };
    /** JPDB kanji frequency rank. */
    frequency?: number;
}
