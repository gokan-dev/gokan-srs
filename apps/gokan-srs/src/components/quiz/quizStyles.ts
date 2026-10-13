import type { AnswerResult } from '../../utils/answerMatching';
import { isNeutral } from '../../services/exercise/grading';
import type { ExerciseGrade } from '../../services/exercise/types';

/** The colours of a card answered short of correct: its note's left accent, its input border, and whether the miss overlay shows. */
export interface MissStyle {
    accentClass: string;
    inputBorderClass: string;
    overlay: boolean;
}

/**
 * How a miss looks on the single-answer card. A neutral miss (isNeutral: a confusable
 * synonym, a sibling demonstrative's meaning) costs nothing, so it takes the near-miss
 * look, muted and without the overlay, rather than the look of a wrong answer.
 */
export function missStyleOf(grade: ExerciseGrade): MissStyle {
    if (grade.slots.length > 0 && grade.slots.every(isNeutral)) {
        return { accentClass: resultAccentClass('minor_error'), inputBorderClass: 'border-secondary', overlay: false };
    }
    return { accentClass: resultAccentClass(grade.overall), inputBorderClass: 'border-feedback-incorrect', overlay: true };
}

/** The left accent of a feedback note: the incorrect colour for wrong, muted for a near miss or a skip, accent for correct. */
export function resultAccentClass(result: AnswerResult | undefined): string {
    if (result === 'wrong') return 'border-l-feedback-incorrect/45';
    if (result === 'minor_error' || result === 'pass') return 'border-l-secondary';
    return 'border-l-accent';
}

/** Text colour for a graded result: correct, a muted near miss, or the incorrect colour for wrong and pass. */
export function resultTextClass(result: AnswerResult): string {
    if (result === 'correct') return 'text-feedback-correct';
    if (result === 'minor_error') return 'text-secondary';
    return 'text-feedback-incorrect';
}

/**
 * The underline of an inline answer blank: neutral (accent on focus) while answering,
 * muted once its hint revealed the answer, then coloured by the graded result.
 */
export function blankBorderClass(result: AnswerResult | undefined, state: { feedbackShown: boolean; revealed: boolean }): string {
    if (!state.feedbackShown) return state.revealed ? 'border-secondary' : 'border-divider focus:border-accent';
    if (result === 'wrong') return 'border-feedback-incorrect';
    if (result === 'minor_error' || result === 'pass') return 'border-secondary';
    return 'border-accent';
}
