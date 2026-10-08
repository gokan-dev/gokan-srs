// src/services/exercise/grading.ts
//
// The one grader. Every exercise's answers go through gradeSlot, step by step in
// the same order, so a typo, another form of the word or a near-synonym grades the
// same whichever exercise asked. Exercises differ only in their slots' data. Pure
// and synchronous: whatever grading needs is resolved when the exercise is built.
import { headwordOf, headwordWithReading } from '@gokan/dataset-schema';
import { matchBest } from '../../utils/answerMatching';
import type { AnswerResult } from '../../utils/answerMatching';
import { isFormOfWord } from '../../utils/inflection.utils';
import { orderSynonymsForCue, sharedMeaningUsed, synonymOutcome } from '../../utils/synonymContext.utils';
import type { ProductionCue } from '../../utils/synonymContext.utils';
import { wordSlot } from './slots';
import type { AnswerSlot, Exercise, ExerciseGrade, SlotGrade, SynonymAnswer, SynonymCandidate } from './types';

/** How good a result is, best last. `pass` sits between: the learner skipped rather than mis-recalled. */
const STANDING: Record<AnswerResult, number> = { wrong: 0, pass: 1, minor_error: 2, correct: 3 };

/** Worst-of across results: wrong > pass > minor_error > correct. */
export function worstOf(results: AnswerResult[]): AnswerResult {
    return results.reduce<AnswerResult>((worst, r) => (STANDING[r] < STANDING[worst] ? r : worst), 'correct');
}

/**
 * Floor of the support coefficient: an answer whose core is right but whose support
 * slots were ALL missed still earns this fraction of the full strength gain (never
 * zero, never negative: the core was demonstrated).
 */
export const SUPPORT_COEFFICIENT_FLOOR = 0.5;

/** Coefficient in [SUPPORT_COEFFICIENT_FLOOR, 1] from the fraction of support slots answered right. None -> 1. */
export function supportCoefficient(results: AnswerResult[]): number {
    if (results.length === 0) return 1;
    const successes = results.filter(r => r === 'correct' || r === 'minor_error').length;
    return SUPPORT_COEFFICIENT_FLOOR + (1 - SUPPORT_COEFFICIENT_FLOOR) * (successes / results.length);
}

/**
 * Finds which of the slot word's near-synonyms the answer is. Each candidate is
 * graded exactly as a production card asking for it would grade the answer, so a
 * candidate's conjugated or kanji form matches it too. An exact match beats a typo
 * match whatever the order: with dozens of candidates the input can be one word's
 * exact form and another's typo at once (つむ is 積む exactly, but used to match 止む
 * as a typo first, reported). Otherwise the first typo match wins, candidates the
 * cue means first.
 */
function findSynonym(input: string, candidates: SynonymCandidate[], cue: ProductionCue): SynonymCandidate | null {
    let typo: SynonymCandidate | null = null;
    for (const candidate of orderSynonymsForCue(candidates, cue)) {
        const slot = wordSlot(candidate.vocab, { otherForm: 'correct', role: 'core', synonyms: [] });
        const { result } = gradeSlot(slot, input, 0, cue);
        if (result === 'correct') return candidate;
        if (result === 'minor_error') typo ??= candidate;
    }
    return typo;
}

/**
 * Grades one answer against its slot:
 * 1. a revealed hint is a near miss (reading the answer still leaves an impression);
 * 2. an empty answer is an explicit "I do not know this one": `pass`, not a wrong guess;
 * 3. the accepted forms, typo-tolerant (`matchBest`);
 * 4. the near forms, a near miss at best;
 * 5. another form of the slot's word, graded by its OtherFormGrade;
 * 6. only for a genuine miss, the word's near-synonyms, judged against the cue.
 * Each step can only improve the grade.
 */
export function gradeSlot(slot: AnswerSlot, input: string, hintLevel: number, cue: ProductionCue): SlotGrade {
    if (hintLevel >= 2) return { result: 'minor_error', shown: slot.reveal };
    if (input.trim().length === 0) return { result: 'pass', shown: slot.reveal };

    const direct = matchBest(input, slot.accept, slot.leniency);
    if (direct.result === 'pass') return { result: 'pass', shown: slot.reveal };
    if (direct.result === 'correct') return { result: 'correct', shown: direct.matchedAnswer };

    let best: SlotGrade = direct.result === 'minor_error'
        ? { result: 'minor_error', shown: direct.matchedAnswer }
        : { result: 'wrong', shown: slot.reveal };

    if (best.result === 'wrong' && slot.near.length > 0) {
        const near = matchBest(input, slot.near, slot.leniency).result;
        if (near === 'correct' || near === 'minor_error') best = { result: 'minor_error', shown: slot.reveal };
    }

    const word = slot.word;
    if (!word) return best;

    // A typo of one form that is exactly another form is that form, so this runs on
    // a near miss too, not only on a miss.
    const { otherForm } = word;
    if (otherForm !== 'off' && word.lemma && STANDING[otherForm] > STANDING[best.result] && isFormOfWord(input, word.lemma)) {
        best = { result: otherForm, shown: slot.reveal };
    }

    if (best.result !== 'wrong' || word.synonyms.length === 0) return best;
    const match = findSynonym(input, word.synonyms, cue);
    if (!match) return best;

    // A pair is a synonym IN A SENSE: 狭い and 小さい share only "small". So the
    // outcome depends on the card's own text (synonymOutcome).
    const outcome = synonymOutcome(match, cue);
    const synonym: SynonymAnswer = {
        vocabId: match.vocabId,
        written: headwordOf(match.vocab),
        label: headwordWithReading(match.vocab),
        outcome,
        meaning: sharedMeaningUsed(match.shared ?? [], cue),
    };
    return { result: outcome === 'confusable' ? 'wrong' : outcome, shown: best.shown, synonym };
}

/** Names the word the learner typed and the one being tested. */
function synonymNote(synonym: SynonymAnswer, tested: string): string {
    switch (synonym.outcome) {
        case 'correct': return `${synonym.label} also means "${synonym.meaning ?? ''}" here. The word being tested was ${tested}.`;
        case 'minor_error': return `${synonym.label} is also accepted here - the word being tested was ${tested}.`;
        case 'confusable': return `${synonym.label} is a close synonym but not interchangeable here - the word being tested was ${tested}.`;
    }
}

function feedbackMessage(exercise: Exercise, slots: SlotGrade[], overall: AnswerResult): string {
    const notes = slots.flatMap((grade, i) => {
        const word = exercise.slots[i].word;
        return grade.synonym && word ? [{ synonym: grade.synonym, note: synonymNote(grade.synonym, word.label) }] : [];
    });

    // On a single-answer card the note is the whole message.
    if (slots.length === 1 && notes.length === 1) {
        const [{ synonym, note }] = notes;
        return synonym.outcome === 'correct' ? `Correct: ${note}` : note;
    }

    const allCorrect = slots.every(s => s.result === 'correct');
    const base = overall === 'correct'
        // A correct core with a missed support slot still grades correct: say so
        // rather than a bare "Correct." next to a highlighted blank.
        ? (allCorrect ? 'Correct.' : 'Grammar correct - check the highlighted word(s).')
        : overall === 'pass' ? 'Revealed - marked as passed.'
            : overall === 'minor_error' ? 'Close.'
                : 'Incorrect.';
    return [base, ...notes.map(n => n.note)].join(' ');
}

/**
 * Grades every slot, then the exercise. A confusable synonym is neutral: it counts
 * neither for nor against the result or the reward. The core slots left decide the
 * result (all of them if every one was neutral, so a lone confusable answer still
 * reads as a miss); the support slots left scale a successful result's reward.
 */
export function gradeExercise(exercise: Exercise, answers: string[], hintLevels: number[]): ExerciseGrade {
    const slots = exercise.slots.map((slot, i) => gradeSlot(slot, answers[i] ?? '', hintLevels[i] ?? 0, exercise.cue));
    const counted = (i: number) => slots[i].synonym?.outcome !== 'confusable';

    // An exercise without core slots is decided by all of them.
    const hasCore = exercise.slots.some(s => s.role === 'core');
    const isCore = (i: number) => !hasCore || exercise.slots[i].role === 'core';
    const core = slots.flatMap((_, i) => (isCore(i) ? [i] : []));
    const deciding = core.filter(counted);
    const overall = worstOf((deciding.length > 0 ? deciding : core).map(i => slots[i].result));

    const support = slots.flatMap((grade, i) => (!isCore(i) && counted(i) ? [grade.result] : []));
    const success = overall === 'correct' || overall === 'minor_error';

    return {
        slots,
        overall,
        strengthModifier: success ? supportCoefficient(support) : 1,
        // The meaning card has sentences and glosses worth reading, so it never moves on by itself.
        autoAdvance: exercise.kind !== 'meaning' && slots.every(s => s.result === 'correct' && !s.synonym),
        message: feedbackMessage(exercise, slots, overall),
    };
}
