// src/services/exercise/effects.ts
//
// What an answer does to the learner's SRS state, as data. effectsOf decides the
// effects from the grade; applyEffects is the only place an answer writes SRS
// state (enforced by lint), so a credit rule lives in one place whichever
// exercise earned it.
import type { UserProgress, UserSettings } from '../../models/user.model';
import type { VocabProgress } from '../../models/vocabulary.model';
import type { GrammarProgress } from '../../models/grammar.model';
import type { AnswerResult } from '../../utils/answerMatching';
import type { QuizType } from '../../utils/srs.utils';
import { calculateMasteryPercentage } from '../../utils/srs.utils';
import { SRSService } from '../srs.service';
import { GrammarSRSService } from '../grammarSrs.service';
import {
    frequencyModifierOf, growthLevelOf, isCalibratedGrammarReview, isCalibratedVocabReview, recordCalibratedAnswer, withCalibrationDefaults,
} from '../calibration';
import { coreSlots } from './grading';
import type { Exercise, ExerciseGrade, HostItem } from './types';

export type Effect =
    /** The asked item's own review, through the one SRS formula. */
    | { kind: 'review'; item: HostItem; label: string; result: AnswerResult; strengthModifier: number; latencyMs: number; blankCount: number }
    /** No credit, no penalty: reschedule at the unchanged interval and ask again. */
    | { kind: 'retry'; item: HostItem; label: string; result: AnswerResult }
    /** Indirect production credit to a word met on another card. */
    | { kind: 'reinforce'; vocabId: string; label: string; result: AnswerResult }
    /** Nothing was asked (the study card): only push the due date out. */
    | { kind: 'defer'; item: HostItem };

export interface AnswerContext {
    item: HostItem;
    /** Names the asked item in the session ticker. */
    label: string;
    latencyMs: number;
    hintLevels: number[];
}

/**
 * The effects of one graded answer. One rule set for every exercise:
 * - a slot answered with another word (a near-synonym) never credits the slot's
 *   word. An accepted one credits the word actually typed instead; a confusable
 *   one is neutral;
 * - if that slot's word is the asked item itself, the item is retried rather than
 *   reviewed: the learner has not produced it yet;
 * - if no deciding slot is left (every one was a confusable synonym), the item is
 *   retried too: nothing decided a result;
 * - any other word answered right without its hint revealed earns indirect
 *   credit, once per word.
 */
export function effectsOf(exercise: Exercise, grade: ExerciseGrade, { item, label, latencyMs, hintLevels }: AnswerContext): Effect[] {
    if (exercise.kind === 'study') return [{ kind: 'defer', item }];

    const askedWord = item.kind === 'vocab' ? item.vocabId : null;
    let producedAnotherWord = false;
    const credits = new Map<string, Effect>();
    const credit = (vocabId: string, creditLabel: string, result: AnswerResult) => {
        if (!credits.has(vocabId)) credits.set(vocabId, { kind: 'reinforce', vocabId, label: creditLabel, result });
    };

    grade.slots.forEach((slotGrade, i) => {
        const word = exercise.slots[i].word;
        const { synonym } = slotGrade;
        if (synonym) {
            if (word?.vocabId !== undefined && word.vocabId === askedWord) producedAnotherWord = true;
            if (synonym.outcome !== 'confusable') credit(synonym.vocabId, synonym.written, slotGrade.result);
            return;
        }
        // A revealed slot was read, not produced.
        if (!word?.vocabId || word.vocabId === askedWord || (hintLevels[i] ?? 0) >= 2) return;
        if (slotGrade.result === 'correct' || slotGrade.result === 'minor_error') credit(word.vocabId, word.headword, slotGrade.result);
    });

    const undecided = coreSlots(exercise).every(i => grade.slots[i].synonym?.outcome === 'confusable');
    const asked: Effect = producedAnotherWord || undecided
        ? { kind: 'retry', item, label, result: grade.overall }
        : { kind: 'review', item, label, result: grade.overall, strengthModifier: grade.strengthModifier, latencyMs, blankCount: exercise.slots.length };
    return [asked, ...credits.values()];
}

/** What one answer did, for the session ticker and its running totals. */
export interface AnswerRecord {
    item: HostItem;
    label: string;
    result: AnswerResult;
    /** The asked item's own mastery change. */
    delta: number;
    /** Mastery credited to other words (a grammar sentence's vocab, a synonym typed). */
    vocabDelta: number;
    /** Per-word split of vocabDelta, biggest gain first. */
    vocabBreakdown: { label: string; delta: number }[];
}

const strengthOf = (vocab: VocabProgress, quizType: QuizType): number =>
    quizType === 'reading' ? vocab.reading.memoryStrength
        : quizType === 'meaning' ? vocab.meaning.memoryStrength
            : (vocab.production?.memoryStrength ?? 0);

/** True when the asked item is awaiting a retry from an earlier answer. */
function inRetry(progress: UserProgress, item: HostItem): boolean {
    switch (item.kind) {
        case 'vocab': return !!progress.learningQueue.find(v => v.vocabId === item.vocabId)?.needsRetry?.[item.quizType];
        case 'grammar': return !!progress.grammarQueue.find(g => g.grammarId === item.grammarId)?.needsRetry;
    }
}

/**
 * Writes one answer's effects to the learner's progress, and reports what changed.
 * Pure: `now` is passed in. Calibration records only `review` effects, so a
 * synonym or an indirect credit is never counted as a scheduled review.
 *
 * Indirect credit (`reinforce`):
 * - goes to the PRODUCTION entry: filling a blank or typing a word from an English
 *   cue is English in, Japanese out, which is production's definition exactly;
 * - is discounted (SRSService.applyProductionReinforcement), since the conditions
 *   are easier than a production card's own, and latency is neutralised;
 * - skips a word the learner is not studying, and is a no-op when production
 *   quizzes are disabled: crediting another direction would restore a mismatch;
 * - is never granted on a retry of the asked item. A retry is a training redo,
 *   and this is also what stops a synonym being farmed on the retry loop: the
 *   second synonym answer finds the word already flagged.
 */
export function applyEffects(
    progress: UserProgress,
    effects: Effect[],
    { now, settings }: { now: Date; settings: UserSettings | null }
): { progress: UserProgress; record: AnswerRecord | null } {
    const meaningEnabled = settings?.enableMeaningQuiz !== false;
    const productionEnabled = settings?.enableProductionQuiz !== false;
    const frequencyModifier = frequencyModifierOf(settings);

    const askedEffect = effects.find((e): e is Exclude<Effect, { kind: 'reinforce' }> => e.kind !== 'reinforce');
    const retrying = askedEffect ? inRetry(progress, askedEffect.item) : false;

    let calibration = withCalibrationDefaults(progress.calibration);
    let learningQueue = progress.learningQueue;
    let grammarQueue = progress.grammarQueue;
    let vocabAnswers = 0;
    let record: AnswerRecord | null = null;
    const credited: { label: string; delta: number }[] = [];

    for (const effect of effects) {
        switch (effect.kind) {
            case 'review':
            case 'retry': {
                const { item } = effect;
                if (item.kind === 'vocab') {
                    const target = learningQueue.find(v => v.vocabId === item.vocabId);
                    if (!target) break;
                    let updated: VocabProgress;
                    if (effect.kind === 'review') {
                        if (isCalibratedVocabReview(target, item.quizType)) {
                            calibration = recordCalibratedAnswer(calibration, item.quizType, effect.result);
                        }
                        updated = SRSService.applyAnswer(
                            target, item.quizType, item.quizMode, effect.result, effect.latencyMs, now,
                            growthLevelOf(calibration, item.quizType), frequencyModifier, meaningEnabled, productionEnabled
                        ).updated;
                    } else {
                        updated = SRSService.rescheduleForRetry(target, item.quizType, now, meaningEnabled, productionEnabled);
                    }
                    learningQueue = learningQueue.map(v => (v.vocabId === item.vocabId ? updated : v));
                    vocabAnswers += 1;
                    const delta = calculateMasteryPercentage(strengthOf(updated, item.quizType)) - calculateMasteryPercentage(strengthOf(target, item.quizType));
                    record = { item, label: effect.label, result: effect.result, delta, vocabDelta: 0, vocabBreakdown: [] };
                } else {
                    const target = grammarQueue.find(g => g.grammarId === item.grammarId);
                    if (!target) break;
                    let updated: GrammarProgress;
                    if (effect.kind === 'review') {
                        if (isCalibratedGrammarReview(target)) {
                            calibration = recordCalibratedAnswer(calibration, 'grammar', effect.result);
                        }
                        updated = GrammarSRSService.applyAnswer(
                            target, effect.result, effect.latencyMs, now,
                            growthLevelOf(calibration, 'grammar'), frequencyModifier, effect.strengthModifier, effect.blankCount
                        ).updated;
                    } else {
                        updated = GrammarSRSService.rescheduleForRetry(target, now);
                    }
                    grammarQueue = grammarQueue.map(g => (g.grammarId === item.grammarId ? updated : g));
                    const delta = calculateMasteryPercentage(updated.entry.memoryStrength) - calculateMasteryPercentage(target.entry.memoryStrength);
                    record = { item, label: effect.label, result: effect.result, delta, vocabDelta: 0, vocabBreakdown: [] };
                }
                break;
            }
            case 'defer': {
                const { item } = effect;
                if (item.kind === 'grammar') {
                    grammarQueue = grammarQueue.map(g => (g.grammarId === item.grammarId ? GrammarSRSService.deferWithoutCredit(g, now) : g));
                }
                break;
            }
            case 'reinforce': {
                if (retrying || !productionEnabled) break;
                const target = learningQueue.find(v => v.vocabId === effect.vocabId);
                if (!target) break;
                const updated = SRSService.applyProductionReinforcement(
                    target, effect.result, now, meaningEnabled, productionEnabled,
                    growthLevelOf(calibration, 'production'), frequencyModifier
                );
                learningQueue = learningQueue.map(v => (v.vocabId === effect.vocabId ? updated : v));
                const delta = calculateMasteryPercentage(strengthOf(updated, 'production')) - calculateMasteryPercentage(strengthOf(target, 'production'));
                if (delta !== 0) credited.push({ label: effect.label, delta });
                break;
            }
        }
    }

    if (record) {
        // Biggest gain first: which word moved most is all anyone scans a short list for.
        const vocabBreakdown = credited.sort((a, b) => b.delta - a.delta);
        record = { ...record, vocabDelta: vocabBreakdown.reduce((sum, c) => sum + c.delta, 0), vocabBreakdown };
    }

    return {
        progress: {
            ...progress,
            learningQueue,
            grammarQueue,
            calibration,
            stats: { ...progress.stats, totalReviews: progress.stats.totalReviews + vocabAnswers },
        },
        record,
    };
}
