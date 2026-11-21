import { describe, expect, it } from 'vitest';
import type { GrammarPoint } from '@gokan/dataset-schema';
import { initialState, quizReducer } from './quizReducer';
import type { QuizState } from './quizReducer';
import { currentDrillCard, drillCardsOf, drillSummary } from './drillSelectors';
import type { Drill, DrillPointInfo } from './drillSelectors';
import { effectsOf } from '../../services/exercise/effects';
import { gradeExercise } from '../../services/exercise/grading';
import { grammarExample, grammarPoint, grammarProgress, mixupRecord, reviewLog, srsEntry, userProgress, userSettings, vocabProgress } from '../../test/fixtures';

const now = new Date('2026-06-10T00:00:00Z');

/** A point whose examples end in its marker, standing where `slot` says. */
const marker = (id: string, text: string, slot: GrammarPoint['slot']): GrammarPoint => grammarPoint({
    id, title: `～${text}`, slot, formation: `Clause + ${text}`,
    examples: ['雨', '風', '雪'].map(lead => grammarExample({ jp: `${lead}${text}`, words: [{ surface: lead, vocabId: null }, { surface: text, vocabId: null }], patternWordIndices: [1] })),
});
const points = [marker('n5-073', 'から', 'clause-final'), marker('n5-074', 'からです', 'predicate-final')];
const info = (p: GrammarPoint): DrillPointInfo => ({ id: p.id, title: p.title, jlptLevel: p.jlptLevel, comparedOn: null });
const drill: Drill = {
    title: 'から / からです',
    cards: drillCardsOf(points.map(point => ({ point, examples: point.examples })), [], 'seed', info),
    points: Object.fromEntries(points.map(p => [p.id, info(p)])),
};

/** A learner who studies both points and a word, with history, calibration and mix-ups: everything an answer could move. */
const studied = () => userProgress({
    learningQueue: [vocabProgress({ vocabId: 'v1', totalReviews: 3, reading: srsEntry({ memoryStrength: 40, history: [reviewLog()] }) })],
    grammarQueue: points.map(p => grammarProgress({
        grammarId: p.id, introductionAt: new Date('2026-06-01T00:00:00Z'), totalReviews: 2,
        entry: srsEntry({ memoryStrength: 30, dueDate: now, history: [reviewLog()] }),
    })),
    mixups: [mixupRecord()],
});

/** Answers the card on screen the way useExerciseTurn does: grade, decide the effects, submit, continue. */
function answer(state: QuizState, pick: (options: string[], right: string) => string): QuizState {
    const card = currentDrillCard(state.drill);
    const turn = state.turns.drill;
    if (!card || !turn) throw new Error('no drill card on screen');
    const value = pick(card.options.map(o => o.text), card.options[0].text);
    const answered = quizReducer(state, { type: 'EXERCISE_SET_ANSWER', host: 'drill', index: 0, value });
    const grade = gradeExercise(turn.exercise, [value], [0]);
    const effects = effectsOf(turn.exercise, grade, { latencyMs: 3000, hintLevels: [0], answers: [value] });
    const submitted = quizReducer(answered, { type: 'EXERCISE_SUBMITTED', host: 'drill', feedback: { grade, effects } });
    return quizReducer(submitted, { type: 'EXERCISE_CONTINUE', host: 'drill', effects, now });
}

describe('a contrast drill (issue #249)', () => {
    const start = () => quizReducer(
        { ...initialState, progressLoaded: true, progress: studied(), settings: userSettings() },
        { type: 'DRILL_START', drill },
    );

    it('shows its first card, then each next one on Continue, and the summary after the last', () => {
        let state = start();
        expect(drill.cards.length).toBeGreaterThan(2);
        expect(state.turns.drill?.exercise).toBe(drill.cards[0].exercise);
        state = answer(state, (_, right) => right);
        expect(state.drill?.index).toBe(1);
        expect(state.turns.drill?.exercise).toBe(drill.cards[1].exercise);
        while (currentDrillCard(state.drill)) state = answer(state, options => options.find(o => o !== options[0]) ?? '');
        expect(state.turns.drill).toBeNull();
        expect(state.drill?.picks).toHaveLength(drill.cards.length);
    });

    it('leaves stored progress byte-identical, whatever is answered', () => {
        const before = start();
        const serialized = JSON.stringify(before.progress);
        let state = before;
        let k = 0;
        // Right, wrong, right...: every outcome a choice card can have.
        while (currentDrillCard(state.drill)) {
            const right = k++ % 2 === 0;
            state = answer(state, (options, correct) => (right ? correct : options.find(o => o !== correct) ?? ''));
        }
        expect(state.progress).toBe(before.progress);
        expect(JSON.stringify(state.progress)).toBe(serialized);
        expect(state.grammarSessionHistory).toEqual(before.grammarSessionHistory);
        expect(state.grammarSessionGains).toEqual(before.grammarSessionGains);
    });

    it('keeps what was picked for its summary', () => {
        let state = start();
        state = answer(state, (_, right) => right);
        state = answer(state, (options, right) => options.find(o => o !== right) ?? '');
        // The right option comes first; the second card's wrong one is the other point.
        const second = drill.cards[1];
        expect(drillSummary(state.drill?.picks ?? [])).toEqual({
            right: 1,
            total: 2,
            confusions: [{ asked: second.point.id, picked: second.options[1].pointId, times: 1 }],
        });
    });

    it('ends: no card, no drill', () => {
        const ended = quizReducer(start(), { type: 'DRILL_END' });
        expect(ended.drill).toBeNull();
        expect(ended.turns.drill).toBeNull();
    });
});
