// src/services/exercise/aiRefine.ts
//
// An optional asynchronous second opinion on a graded meaning card in context
// mode: Gemini judges whether the answer fits the sentence. It runs after the pure
// grade, in the shared submit flow, so grading itself stays synchronous.
import type { Vocabulary } from '@gokan/dataset-schema';
import { LLMService } from '../llm.service';
import type { Exercise, ExerciseGrade } from './types';

export interface AiMeaningCheck {
    apiKey: string;
    /** Check every answer, even a strictly correct one; otherwise only misses and near misses. */
    always: boolean;
}

/**
 * The grade, revised by the AI check when it applies: a meaning card in context
 * mode, with a sentence and an answer. `check` is null when the learner has not
 * enabled it (a leftover API key must not keep triggering calls). A failed call
 * falls back to the strict grade.
 */
export async function refineMeaningWithAi(
    exercise: Exercise,
    grade: ExerciseGrade,
    answer: string,
    vocab: Vocabulary,
    check: AiMeaningCheck | null,
    onStart: () => void
): Promise<ExerciseGrade> {
    if (!check || exercise.kind !== 'meaning' || !exercise.contextRequested || !exercise.sentence || answer.trim().length === 0) return grade;
    if (!check.always && grade.overall !== 'wrong' && grade.overall !== 'minor_error') return grade;

    try {
        onStart();
        const ai = await LLMService.validateMeaningContext(check.apiKey, vocab, exercise.sentence, answer);
        const accepted = ai.result === 'correct' || ai.result === 'minor_error';
        const overall = accepted ? ai.result : 'wrong';
        const reason = ai.reason ?? '';
        const message = ai.result === 'correct' ? `Correct. (AI Validated: ${reason})`
            : ai.result === 'minor_error' ? `Close. ${reason}`
                : reason ? `Incorrect. (AI: ${reason})` : 'Incorrect.';
        const [slot, ...rest] = grade.slots;
        return {
            ...grade,
            overall,
            message,
            slots: [{ ...slot, result: overall, shown: accepted ? answer : slot.shown }, ...rest],
        };
    } catch (e) {
        console.error('[aiRefine] AI evaluation failed, falling back to strict result.', e);
        return grade;
    }
}
