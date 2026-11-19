import { primaryPitchAccent, type PitchAccent, type Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../context/useQuiz";
import { DEFAULT_SETTINGS } from "../models/user.model";

/**
 * The pitch accent to draw over a word's primary reading, or nothing: when the dataset has none,
 * or when the learner turned it off ("Show pitch accent", Settings), which hides it everywhere.
 */
export function usePitchAccent(vocab: Pick<Vocabulary, 'reading' | 'pitchAccent'>): PitchAccent | undefined {
    const { state } = useQuiz();
    const show = state.settings?.showPitchAccent ?? DEFAULT_SETTINGS.showPitchAccent;
    return show ? primaryPitchAccent(vocab) : undefined;
}
