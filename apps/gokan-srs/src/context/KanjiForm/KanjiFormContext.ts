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
  setKanjiCount: (n: number) => void;
  toggleKanji: (k: string) => void;
  /** Switches the order the count walks: the known set becomes that method's first N kanji. */
  setKanjiMethod: (method: KanjiLearningMethod) => void;
};

export const KanjiFormContext = createContext<KanjiFormContextValue | null>(null);