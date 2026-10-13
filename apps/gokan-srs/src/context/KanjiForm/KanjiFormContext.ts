import {createContext} from "react";
import type {KanjiLearningMethod} from "../../models/user.model";

export type KanjiFormState = {
  allKanji: string[]
  kanjiCount: number;
  knownKanji: Set<string>;
  kanjiMethod: KanjiLearningMethod;
  loading: boolean;
};

export type KanjiFormContextValue = {
  state: KanjiFormState;
  /** Moves the count through the current order: raising adds its kanji, lowering takes them back. */
  setKanjiCount: (n: number) => void;
  toggleKanji: (k: string) => void;
  /** Switches the order the count walks. The known set is kept; the count starts where it already reaches. */
  setKanjiMethod: (method: KanjiLearningMethod) => void;
  /** Starts over: only the current order's first N kanji, no individual marks. */
  resetKanji: () => void;
};

export const KanjiFormContext = createContext<KanjiFormContextValue | null>(null);