// src/services/exercise/grading.ts
//
// The one grader. Every exercise's answers go through gradeSlot, step by step in
// the same order, so a typo, another form of the word or a near-synonym grades the
// same whichever exercise asked. Exercises differ only in their slots' data. Pure
// and synchronous: whatever grading needs is resolved when the exercise is built.
import { headwordOf, headwordWithReading } from '@gokan/dataset-schema';
import { matchBest } from '../../utils/answerMatching';
import type { AnswerResult } from '../../utils/answerMatching';
import { isFormOfWord, sameFormUpToRegister } from '../../utils/inflection.utils';
import type { ProductionCue } from '../../utils/synonymContext.utils';
import { DEMONSTRATIVE_SERIES_NOTE } from './demonstratives';
import type { DemonstrativeParadigm } from './demonstratives';
import { wordSlot } from './slots';
import { OUTCOME_LOOK, orderSynonymsForCue, outcomeOf, relationOf, synonymNote } from './wordRelation';
import type { AnswerSlot, ExerciseGrade, GradedExercise, SiblingAnswer, SlotGrade, SlotInflection, SynonymAnswer, SynonymCandidate, SynonymMatch } from './types';

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
 * candidate's conjugated or kanji form matches it too. The closest match wins
 * whatever the order: with dozens of candidates the input can be one word's exact
 * form and another's typo at once (つむ is 積む exactly, but used to match 止む as a
 * typo first, reported), or another's form only through the lenient kanji skeleton
 * (止む is 止む exactly, but 止す's 止 plus any kana also grades it). So one of a
 * candidate's own forms beats any other correct match, which beats a typo; within
 * each, candidates the cue means first. `match` says whether the answer is the word
 * (one of its forms, or an inflection of one) or only close to it.
 */
function findSynonym(input: string, candidates: SynonymCandidate[], cue: ProductionCue): { candidate: SynonymCandidate; match: SynonymMatch } | null {
    const answer = input.trim();
    let correct: { candidate: SynonymCandidate; match: SynonymMatch } | null = null;
    let typo: SynonymCandidate | null = null;
    for (const candidate of orderSynonymsForCue(candidates, cue)) {
        const slot = wordSlot(candidate.vocab, { otherForm: 'correct', role: 'core', candidates: [] });
        const { result } = gradeSlot(slot, input, 0, cue);
        if (result === 'correct') {
            if (slot.accept.includes(answer)) return { candidate, match: 'form' };
            const lemma = slot.word?.lemma;
            correct ??= { candidate, match: lemma && isFormOfWord(input, lemma, { loose: false }) ? 'form' : 'loose' };
        }
        if (result === 'minor_error') typo ??= candidate;
    }
    return correct ?? (typo ? { candidate: typo, match: 'loose' } : null);
}

/**
 * The grade of an answer that is the slot's text with this word in another of its
 * forms, or null when it is not. Politeness alone (がある for があります) is still
 * the right answer when the card asks for no register: the sense is the same.
 */
function reconjugationGrade(input: string, { lead, word, form, tail, registerFree }: SlotInflection): AnswerResult | null {
    const answer = input.trim();
    let grade: AnswerResult | null = null;
    for (const l of lead) {
        for (const t of tail) {
            if (answer.length <= l.length + t.length || !answer.startsWith(l) || !answer.endsWith(t)) continue;
            const middle = answer.slice(l.length, answer.length - t.length);
            if (!isFormOfWord(middle, word)) continue;
            if (registerFree && form.some(f => sameFormUpToRegister(middle, f, word))) return 'correct';
            grade = 'minor_error';
        }
    }
    return grade;
}

/**
 * Grades one answer against its slot:
 * 1. a revealed hint is a near miss (reading the answer still leaves an impression);
 * 2. an empty answer is an explicit "I do not know this one": `pass`, not a wrong guess;
 * 3. the accepted forms, typo-tolerant (`matchBest`);
 * 4. the near forms, a near miss at best, then the slot's text with one of its
 *    conjugated words in another form: correct when only politeness changed and
 *    the card asks for no register (がある for があります), a near miss otherwise;
 * 5. another form of the slot's word, graded by its OtherFormGrade;
 * 6. only for a genuine miss, the word's near-synonyms, judged against the cue;
 * 7. on a demonstrative's meaning answered short of correct, a sibling's meaning
 *    (それ answered "this"): still a miss, but a neutral one, and it outranks a
 *    typo of the word's own meaning.
 * Each step can only improve the grade, except 7, which makes it neutral.
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

    // Only a genuine miss: a form the near tier holds (another register a sibling
    // point covers) stays the near miss it is.
    if (best.result === 'wrong' && slot.inflections) {
        const grades = slot.inflections.map(inflection => reconjugationGrade(input, inflection));
        if (grades.includes('correct')) best = { result: 'correct', shown: input.trim() };
        else if (grades.includes('minor_error')) best = { result: 'minor_error', shown: slot.reveal };
    }

    // Not only a genuine miss: a sibling's exact meaning is the confusion, not a typo
    // ("here" on あそこ is ここ, not a misspelt "there").
    if (best.result !== 'correct' && slot.paradigm) {
        const sibling = siblingAnswer(input, slot.paradigm);
        if (sibling) return { result: 'wrong', shown: slot.reveal, sibling };
    }

    const word = slot.word;
    if (!word) return best;

    // A typo of one form that is exactly another form is that form, so this runs on
    // a near miss too, not only on a miss.
    const { otherForm } = word;
    if (otherForm !== 'off' && word.lemma && STANDING[otherForm] > STANDING[best.result] && isFormOfWord(input, word.lemma)) {
        best = { result: otherForm, shown: slot.reveal };
    }

    if (best.result !== 'wrong' || word.candidates.length === 0) return best;
    const found = findSynonym(input, word.candidates, cue);
    if (!found) return best;
    const { candidate: match } = found;

    // A pair is a synonym IN A SENSE: 狭い and 小さい share only "small". So the
    // outcome depends on the card's own text (relationOf, outcomeOf).
    const relation = relationOf(match, cue);
    const outcome = outcomeOf(relation);
    const synonym: SynonymAnswer = {
        vocabId: match.vocabId,
        written: headwordOf(match.vocab),
        label: headwordWithReading(match.vocab),
        outcome,
        relation,
        match: found.match,
    };
    return { result: OUTCOME_LOOK[outcome].result, shown: best.shown, synonym };
}

/**
 * The siblings whose meaning the answer is, when it is one. Only an exact match: a
 * typo of "this" is too close to "that" to tell which word was meant.
 */
function siblingAnswer(input: string, paradigm: DemonstrativeParadigm): SiblingAnswer | undefined {
    const words = paradigm.siblings.filter(s => matchBest(input, s.answers).result === 'correct').map(s => s.word);
    return words.length > 0 ? { answer: input.trim(), words } : undefined;
}

/** Names the word asked (`tested`, the exercise's label), the word the answer means, and the series. */
function siblingNote({ answer, words }: SiblingAnswer, paradigm: DemonstrativeParadigm, tested: string): string {
    return `${tested} means "${paradigm.meaning}". "${answer}" is ${words.join(' or ')}. ${DEMONSTRATIVE_SERIES_NOTE}`;
}

/** A slot answered with another word's meaning or form: neutral, it counts neither for nor against the result. */
export function isNeutral(grade: SlotGrade): boolean {
    return (grade.synonym !== undefined && OUTCOME_LOOK[grade.synonym.outcome].neutral) || grade.sibling !== undefined;
}

/** A slot answered with a near-synonym that answers the card (in context, or an interchangeable pair): accepted, short of the word asked. */
export function isAcceptedSynonym(grade: SlotGrade): boolean {
    return grade.synonym !== undefined && OUTCOME_LOOK[grade.synonym.outcome].accepted;
}

function feedbackMessage(exercise: GradedExercise, slots: SlotGrade[], overall: AnswerResult): string {
    const notes = slots.flatMap((grade, i) => {
        const { word, paradigm } = exercise.slots[i];
        if (grade.synonym && word) return [{ correct: grade.synonym.outcome === 'correct', note: synonymNote(grade.synonym.outcome, grade.synonym.label, word.label, grade.synonym.relation.meaning) }];
        if (grade.sibling && paradigm) return [{ correct: false, note: siblingNote(grade.sibling, paradigm, exercise.label) }];
        return [];
    });

    // On a single-answer card the note is the whole message.
    if (slots.length === 1 && notes.length === 1) {
        const [{ correct, note }] = notes;
        return correct ? `Correct: ${note}` : note;
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

/** The indices of the slots that decide the exercise's result. An exercise without core slots is decided by all of them. */
export function coreSlots(exercise: Pick<GradedExercise, 'slots'>): number[] {
    const hasCore = exercise.slots.some(s => s.role === 'core');
    return exercise.slots.flatMap((slot, i) => (!hasCore || slot.role === 'core' ? [i] : []));
}

/**
 * Grades every slot, then the exercise. A confusable synonym or a sibling
 * demonstrative is neutral (isNeutral): it counts neither for nor against the
 * result or the reward. The core slots left decide the result (all of them if every
 * one was neutral, so a lone neutral answer still reads as a miss); the support
 * slots left scale a successful result's reward.
 */
export function gradeExercise(exercise: GradedExercise, answers: string[], hintLevels: number[]): ExerciseGrade {
    const slots = exercise.slots.map((slot, i) => gradeSlot(slot, answers[i] ?? '', hintLevels[i] ?? 0, exercise.cue));
    const counted = (i: number) => !isNeutral(slots[i]);

    const core = coreSlots(exercise);
    const deciding = core.filter(counted);
    const overall = worstOf((deciding.length > 0 ? deciding : core).map(i => slots[i].result));

    const support = slots.flatMap((grade, i) => (!core.includes(i) && counted(i) ? [grade.result] : []));
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
