// Reading a search index row's flags. Separate from searchIndex.ts, and importing nothing, so the
// page-wide search script can read a row without bundling the conjugation rules: those load with
// the query engine, on first focus.

import type { SearchWordRow } from './types';

export const FLAG_COMMON = 1;
export const FLAG_USUALLY_KANA = 2;
/** The conjugation class is stored above the two flags, as its WORD_CLASSES position plus one. */
export const CLASS_SHIFT = 2;

export const isCommonRow = (row: SearchWordRow): boolean => (row[5] & FLAG_COMMON) !== 0;

/** The kana reading of a row: the headword itself for a word learned in kana. */
export const readingOfRow = (row: SearchWordRow): string => ((row[5] & FLAG_USUALLY_KANA) !== 0 ? row[1] : row[2]);

/** The row's class code: 0 for a word that does not conjugate. */
export const classCodeOfRow = (row: SearchWordRow): number => row[5] >> CLASS_SHIFT;
