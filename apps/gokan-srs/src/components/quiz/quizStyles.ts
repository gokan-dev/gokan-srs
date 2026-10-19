import type { AnswerResult } from '../../utils/answerMatching';
import { isAcceptedSynonym, isNeutral } from '../../services/exercise/grading';
import type { ExerciseGrade, SlotGrade } from '../../services/exercise/types';
import type { ShownResult } from '../../services/exercise/effects';

/**
 * How a card answered short of correct looks: its note's left accent, its input
 * border, whether the miss overlay shows, and the heading over the word it shows.
 */
export interface MissStyle {
    accentClass: string;
    inputBorderClass: string;
    overlay: boolean;
    heading: string;
}

/**
 * How a miss looks on the single-answer card:
 * - a neutral miss (isNeutral: a confusable synonym, a sibling demonstrative's
 *   meaning) costs nothing, so it is muted and without the overlay;
 * - an accepted synonym (an interchangeable pair out of context, `minor_error`)
 *   answers the card, so it is never drawn as wrong either, and the word it shows is
 *   the one being tested, not a correction;
 * - anything else is a miss.
 */
export function missStyleOf(grade: ExerciseGrade): MissStyle {
    const muted = { accentClass: resultAccentClass('minor_error'), inputBorderClass: 'border-secondary', overlay: false };
    if (grade.slots.length > 0 && grade.slots.every(isNeutral)) return { ...muted, heading: 'Correct answer' };
    if (grade.slots.length > 0 && grade.slots.every(isAcceptedSynonym)) return { ...muted, heading: 'The word being tested' };
    return { accentClass: resultAccentClass(grade.overall), inputBorderClass: 'border-feedback-incorrect', overlay: true, heading: 'Correct answer' };
}

/** The left accent of a feedback note: the incorrect colour for wrong, muted for a near miss or a skip, accent for correct. */
export function resultAccentClass(result: AnswerResult | undefined): string {
    if (result === 'wrong') return 'border-l-feedback-incorrect/45';
    if (result === 'minor_error' || result === 'pass') return 'border-l-secondary';
    return 'border-l-accent';
}

/** Text colour for a graded result: correct, a muted near miss or neutral answer, or the incorrect colour for wrong and pass. */
export function resultTextClass(result: ShownResult): string {
    if (result === 'correct') return 'text-feedback-correct';
    if (result === 'minor_error' || result === 'neutral') return 'text-secondary';
    return 'text-feedback-incorrect';
}

/**
 * The underline of an inline answer blank: neutral (accent on focus) while answering,
 * muted once its hint revealed the answer, then coloured by the graded result. A
 * neutral blank (isNeutral) costs nothing, so it is muted rather than drawn wrong.
 */
export function blankBorderClass(grade: SlotGrade | undefined, state: { feedbackShown: boolean; revealed: boolean }): string {
    if (!state.feedbackShown) return state.revealed ? 'border-secondary' : 'border-divider focus:border-accent';
    if (grade && isNeutral(grade)) return 'border-secondary';
    const result = grade?.result;
    if (result === 'wrong') return 'border-feedback-incorrect';
    if (result === 'minor_error' || result === 'pass') return 'border-secondary';
    return 'border-accent';
}
