// How the /search/ page lists a section it does not page (kanji, grammar): whole while it is
// short, else its first rows and the rest behind a disclosure (client/search.ts). Every row is
// listed, so the heading's count, the disclosure's "Show all N" and the rows agree.

/** A section of up to this many rows is listed whole: a disclosure hiding two or three rows costs a tap for nothing. */
export const FOLD_WHOLE_UP_TO = 8;
/** Past that, the rows shown before the disclosure, so the sections after this one stay in reach. */
export const FOLD_VISIBLE = 5;

export interface FoldedRows<Row> {
    shown: Row[];
    /** Empty when the section is listed whole. */
    hidden: Row[];
}

export function foldRows<Row>(rows: readonly Row[]): FoldedRows<Row> {
    if (rows.length <= FOLD_WHOLE_UP_TO) return { shown: [...rows], hidden: [] };
    return { shown: rows.slice(0, FOLD_VISIBLE), hidden: rows.slice(FOLD_VISIBLE) };
}
