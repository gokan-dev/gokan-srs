import type { KanjiKnowledge, UserProgress, UserSettings } from "./user.model";

export type SessionState =
    | 'review'            // due reviews exist
    | 'learn'             // can add new words
    | 'learn-kanji'       // no new words, out of kanji, headroom left
    | 'session-complete'  // this session's committed workload is cleared, but work the cap left out is still due
    | 'waiting'           // waiting for next review
    | 'exhausted';        // no vocab left at all

export interface SetupValues {
    kanjiKnowledge: KanjiKnowledge
    settings: UserSettings
}

export interface SetupCompleteValues {
    progress: UserProgress,
    settings: UserSettings
}