import type { AnswerResult } from '../../utils/answerMatching';

/** The left accent of a feedback note: error for wrong, muted for a near miss or a skip, accent for correct. */
export function resultAccentClass(result: AnswerResult | undefined): string {
    if (result === 'wrong') return 'border-l-error-accent';
    if (result === 'minor_error' || result === 'pass') return 'border-l-secondary';
    return 'border-l-accent';
}

/**
 * The underline of an inline answer blank: neutral (accent on focus) while answering,
 * muted once its hint revealed the answer, then coloured by the graded result.
 */
export function blankBorderClass(result: AnswerResult | undefined, state: { feedbackShown: boolean; revealed: boolean }): string {
    if (!state.feedbackShown) return state.revealed ? 'border-secondary' : 'border-divider focus:border-accent';
    if (result === 'wrong') return 'border-error';
    if (result === 'minor_error' || result === 'pass') return 'border-secondary';
    return 'border-accent';
}
