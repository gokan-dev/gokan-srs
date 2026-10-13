import {createContext} from "react";
import type {KanjiLearningMethod} from "../../models/user.model";

export type KanjiFormState = {
  allKanji: string[]
  /** The count input: how far this visit's raises reach in the current order. */
  kanjiCount: number;
  /** How many of the current order's first kanji are known: the `step` that sequences new words. */
  knownPrefix: number;
  knownKanji: Set<string>;
  kanjiMethod: KanjiLearningMethod;
  loading: boolean;
};

export type KanjiFormContextValue = {
  state: KanjiFormState;
  /** Moves the count through the current order: raising adds its kanji, lowering takes back only what this visit's raises added. */
  setKanjiCount: (n: number) => void;
  toggleKanji: (k: string) => void;
  /** Switches the order the count walks. The known set is kept; the count starts at 0. */
  setKanjiMethod: (method: KanjiLearningMethod) => void;
  /** Starts over: only the current order's first N kanji, no individual marks. */
  resetKanji: () => void;
};

export const KanjiFormContext = createContext<KanjiFormContextValue | null>(null);