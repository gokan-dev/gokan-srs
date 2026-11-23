// src/context/quiz/drillSelectors.ts
//
// The contrast drill (issue #249): a short quiz over one set of similar grammar
// points, open to every learner on every point, that never touches the SRS. Each
// card is a grammar-choice exercise in `drill` mode, so it runs on the exercise
// engine like any other, and effectsOf decides nothing for it.
import type { GrammarContrastCase, GrammarContrastIndex, GrammarContrastLesson, GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
import type { DrillPointInfo, DrillSet } from '../../models/grammar.model';
import { CONSTANTS } from '../../commons/constants';
import { GrammarService } from '../../services/grammar.service';
import { choiceSlot } from '../../services/exercise/slots';
import type { Exercise } from '../../services/exercise/types';
import { grammarClozeSentence } from '../../utils/clozeSentence.utils';
import { hashString } from '../../utils/deterministicPick';
import { choiceDistractors, markerTextOf, patternTextOf } from './grammarSelectors';

/**
 * A drill's card: a grammar-choice exercise in drill mode that names its point. What
 * the card shows is all on it: each wrong option's point and contrast case are on
 * its choice (SlotChoice.pointId, .contrast).
 */
export type DrillExercise = Extract<Exercise, { kind: 'grammar-choice' }> & { mode: 'drill'; point: DrillPointInfo };

export interface Drill {
    title: string;
    cards: DrillExercise[];
    /** Every point an option names, for the summary. */
    points: Record<string, DrillPointInfo>;
    /**
     * On a family's drill whose cards tell apart the points of only some of its lessons: the
     * titles of those it covers, and how many lessons the family has, so its first screen says
     * which (a lesson with no card was once left out without a word).
     */
    lessons?: { covered: string[]; total: number };
}

/** One answered card: the point that fitted, the one picked (null when the pick names none), and whether it was right. */
export interface DrillPick {
    asked: string;
    picked: string | null;
    right: boolean;
}

/** A pair confused in a drill: `picked` chosen where `asked` fitted, `times` times. */
export interface DrillConfusion {
    asked: string;
    picked: string;
    times: number;
}

/**
 * A drill being answered: the card on screen (`index`; past the last one, the summary)
 * and what was picked so far. `path` is its page (drillPath) and `seed` the order it was
 * built in, so its page, left for a lookup and opened again, resumes it.
 */
export interface DrillRun {
    path: string;
    seed: string;
    drill: Drill;
    index: number;
    picks: DrillPick[];
}

/** The card on screen, or null once every card is answered. */
export function currentDrillCard(run: DrillRun | null): DrillExercise | null {
    return run?.drill.cards[run.index] ?? null;
}

/** The run a drill page shows: the one on its path, kept while the learner looked something up. */
export function runOnPath(run: DrillRun | null, path: string): DrillRun | null {
    return run?.path === path ? run : null;
}

/** The point ids a card offers, the asked one first. */
export function optionPointsOf(card: DrillExercise): string[] {
    return [card.point.id, ...(card.slots[0]?.choices ?? []).flatMap(c => (c.pointId ? [c.pointId] : []))];
}

/** What one answered card is for the summary: the point whose option was picked, if the answer is one. */
export function pickOf(card: DrillExercise, answer: string, right: boolean): DrillPick {
    const picked = right ? card.point.id : card.slots[0]?.choices?.find(c => c.text === answer)?.pointId ?? null;
    return { asked: card.point.id, picked, right };
}

/** One point with the sentences it can be drilled on: its curated examples and its mined ones. */
export interface DrillSource {
    point: GrammarPoint;
    examples: GrammarExample[];
}

/**
 * Whether the dataset says `sibling` does not fit `point`'s blank in `example`: it is
 * ruled out there by connection (GrammarExample.ruledOut), or the two are authored to
 * stand in different places of a sentence (GrammarPoint.slot: でも at the start, けど
 * at the end of a clause). Anything else might fit, so it is never a wrong answer.
 */
export function rulesOut(point: Pick<GrammarPoint, 'slot'>, sibling: Pick<GrammarPoint, 'id' | 'slot'>, example: Pick<GrammarExample, 'ruledOut'>): boolean {
    if ((example.ruledOut ?? []).includes(sibling.id)) return true;
    return !!point.slot && !!sibling.slot && point.slot !== sibling.slot;
}

/** The case that teaches the pair: one where `asked` fits and `picked` does not, else one the other way round. */
export function caseFor(asked: string, picked: string, cases: readonly GrammarContrastCase[]): GrammarContrastCase | undefined {
    return cases.find(c => c.focus === asked && c.vs.includes(picked))
        ?? cases.find(c => c.focus === picked && c.vs.includes(asked));
}

/**
 * One card: the example's pattern blanked, picked among the points of the set, of the
 * asked point's family, that the dataset rules out there. A chapter mixes families, and
 * a point of another family is no contrast (a sentence-initial one against a
 * clause-final one is trivially told apart). Null when none is.
 */
function drillCardOf(source: DrillSource, exampleIndex: number, set: readonly GrammarPoint[], cases: readonly GrammarContrastCase[], info: (p: GrammarPoint) => DrillPointInfo): DrillExercise | null {
    const { point } = source;
    const example = source.examples[exampleIndex];
    const answer = patternTextOf(example);
    if (!answer) return null;
    const seed = `${point.id}:${example.jp}`;
    const siblings = set.filter(s => s.id !== point.id && s.family?.id === point.family?.id && rulesOut(point, s, example));
    const distractors = choiceDistractors(answer, siblings, seed).slice(0, CONSTANTS.srs.grammar.maxChoiceDistractors);
    if (distractors.length === 0) return null;

    const span = [...example.patternWordIndices].sort((a, b) => a - b);
    return {
        kind: 'grammar-choice',
        mode: 'drill',
        host: { kind: 'grammar', grammarId: point.id },
        label: point.title,
        slots: [choiceSlot({
            answer,
            distractors: distractors.map(({ text, note, pointId }) => {
                const contrast = caseFor(point.id, pointId, cases);
                return { text, note, pointId, ...(contrast ? { contrast } : {}) };
            }),
            role: 'core',
            seed,
        })],
        cue: {},
        sentence: grammarClozeSentence(example, [span], `drill:${point.id}:${exampleIndex}`),
        point: info(point),
    };
}

/**
 * One card from a contrast case: the dataset's authored statement that in its situation
 * `focus` fits and each `vs` point does not. Its situation is asked (there is no sentence),
 * `focus`'s marker is the answer and each `vs` point of the set a wrong option, the case's
 * guidance its note. A case needs no `ruledOut` on any example, so a lesson whose examples
 * rule nothing out still has a card for each of its cases. Its guidance is not an option's note:
 * each wrong option carries the case (`contrast`), drawn once after a wrong pick as a sentence
 * card's case is (DrillContrastNote), without its situation, which is the card's question. The
 * card is graded on the case's authored preference, so a `vs` point that could fit, only less
 * well (ので over から), is a wrong answer here. Null when no `vs` point of the set has a marker
 * of its own.
 */
function caseCardOf(contrast: GrammarContrastCase, set: readonly GrammarPoint[], info: (p: GrammarPoint) => DrillPointInfo): DrillExercise | null {
    const point = set.find(p => p.id === contrast.focus);
    if (!point) return null;
    const answer = info(point).marker;
    const seed = `case:${contrast.focus}>${contrast.vs.join(',')}`;
    const distractors: { text: string; pointId: string; contrast: GrammarContrastCase }[] = [];
    for (const sibling of set.filter(p => contrast.vs.includes(p.id))) {
        const text = info(sibling).marker;
        if (text === answer || distractors.some(d => d.text === text)) continue;
        distractors.push({ text, pointId: sibling.id, contrast });
    }
    if (distractors.length === 0) return null;
    return {
        kind: 'grammar-choice',
        mode: 'drill',
        host: { kind: 'grammar', grammarId: point.id },
        label: point.title,
        slots: [choiceSlot({ answer, distractors: distractors.slice(0, CONSTANTS.srs.grammar.maxChoiceDistractors), role: 'core', seed })],
        cue: {},
        sentence: null,
        situation: contrast.situation,
        point: info(point),
    };
}

/** What orders a card among its point's: its sentence, or a case card's situation. */
function orderKeyOf(card: DrillExercise): string {
    return card.sentence?.sentence.original ?? card.situation ?? '';
}

/**
 * One point's cards, its sentences' and its cases' (where it is the case's focus), in a hash of `seed`'s order. On a point's drill (`focus`), only
 * the cards that ask the point or offer it.
 */
function pointCardsOf(source: DrillSource, set: readonly GrammarPoint[], cases: readonly GrammarContrastCase[], seed: string, info: (p: GrammarPoint) => DrillPointInfo, focus?: string): DrillExercise[] {
    return [
        ...source.examples.map((_, i) => drillCardOf(source, i, set, cases, info)),
        ...cases.filter(c => c.focus === source.point.id).map(c => caseCardOf(c, set, info)),
    ]
        .filter(c => c !== null)
        .filter(c => focus === undefined || optionPointsOf(c).includes(focus))
        .sort((a, b) => hashString(`${seed}:${orderKeyOf(a)}`) - hashString(`${seed}:${orderKeyOf(b)}`));
}

/**
 * Interleaves the groups' items: every group once first, then the group with the
 * most left, never the one just met, until `max` or nothing can follow without a
 * repeat. Groups keep their given order on a tie.
 */
export function interleave<T>(groups: readonly { key: string; items: readonly T[] }[], max: number): T[] {
    const queues = groups.filter(g => g.items.length > 0).map(g => ({ key: g.key, items: [...g.items] }));
    const out: T[] = [];
    let last: string | null = null;
    const take = (queue: { key: string; items: T[] }) => {
        const item = queue.items.shift();
        if (item === undefined) return;
        out.push(item);
        last = queue.key;
    };
    for (const queue of queues) {
        if (out.length >= max) break;
        take(queue);
    }
    while (out.length < max) {
        const next = queues
            .filter(q => q.items.length > 0 && q.key !== last)
            .reduce<{ key: string; items: T[] } | null>((best, q) => (best === null || q.items.length > best.items.length ? q : best), null);
        if (!next) break;
        take(next);
    }
    return out;
}

/**
 * The drill's cards over a set of points: one pass over every usable example and every
 * contrast case of the set, interleaved so every point is met and never twice in a row,
 * capped at drillMaxCards. An example is usable when its pattern is
 * located and at least one other point of the set and of its family is ruled out there
 * (rulesOut): only those are offered as wrong answers. A case is usable when one of its
 * `vs` points is in the set (caseCardOf). Every card tells two points apart, so a set with
 * one card has a drill; empty when it has none. `seed` orders points and sentences, so a
 * drill run again can come out differently without the builder reading a clock.
 *
 * A point's drill (`focus`) keeps only the cards that ask the point or offer it, and
 * meets the point's own first, so the cap never cuts them: whether it has cards does not
 * depend on the seed. A point offered as a wrong option on another's card is drilled on
 * that card (だれか, ruled out on だれも's case, once had no drill of its own).
 */
export function drillCardsOf(sources: readonly DrillSource[], cases: readonly GrammarContrastCase[], seed: string, info: (p: GrammarPoint) => DrillPointInfo, focus?: string): DrillExercise[] {
    const set = sources.map(s => s.point);
    const groups = sources
        .map(source => ({ key: source.point.id, items: pointCardsOf(source, set, cases, seed, info, focus) }))
        .filter(g => g.items.length > 0)
        .sort((a, b) => Number(b.key === focus) - Number(a.key === focus) || hashString(`${seed}:${a.key}`) - hashString(`${seed}:${b.key}`));
    return interleave(groups, CONSTANTS.srs.grammar.drillMaxCards);
}

/** The items that share a family with at least one other: what a chapter can drill (a chapter mixes unrelated points too). */
export function withSharedFamily<T>(items: readonly T[], familyOf: (item: T) => string | undefined): T[] {
    const counts = new Map<string, number>();
    for (const item of items) {
        const family = familyOf(item);
        if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    return items.filter(item => (counts.get(familyOf(item) ?? '') ?? 0) >= 2);
}

/** The drill's end summary: how many right, and the pairs confused, most often first. */
export function drillSummary(picks: readonly DrillPick[]): { right: number; total: number; confusions: DrillConfusion[] } {
    const confusions: DrillConfusion[] = [];
    for (const { asked, picked, right } of picks) {
        if (right || picked === null) continue;
        const known = confusions.find(c => c.asked === asked && c.picked === picked);
        if (known) known.times += 1;
        else confusions.push({ asked, picked, times: 1 });
    }
    return {
        right: picks.filter(p => p.right).length,
        total: picks.length,
        // Stable: pairs confused as often keep the order they were first confused in.
        confusions: confusions.sort((a, b) => b.times - a.times),
    };
}

/**
 * The lessons a family's cards cover: one is covered when some card offers two of its points.
 * Undefined when every lesson is covered (or there are none), so a drill says it only when
 * its cards leave a lesson out.
 */
export function lessonsCovered(cards: readonly DrillExercise[], lessons: readonly Pick<GrammarContrastLesson, 'title' | 'points'>[]): Drill['lessons'] {
    const covered = lessons.filter(lesson => cards.some(card => optionPointsOf(card).filter(id => lesson.points.includes(id)).length >= 2));
    return covered.length < lessons.length ? { covered: covered.map(l => l.title), total: lessons.length } : undefined;
}

/** A set of points of its own: every DrillSet but a point's, which is drilled in one of these. */
type GroupSet = Exclude<DrillSet, { kind: 'point' }>;

/** The point ids a set covers, and its title. Null when the set names nothing the dataset has. */
async function membersOf(set: GroupSet, contrasts: GrammarContrastIndex): Promise<{ title: string; ids: string[] } | null> {
    switch (set.kind) {
        case 'lesson': {
            const lesson = contrasts[set.familyId]?.lessons.find(l => l.id === set.lessonId);
            return lesson ? { title: lesson.title, ids: lesson.points } : null;
        }
        case 'family': {
            const rows = (await GrammarService.loadBrowseIndex())?.points.filter(r => r.familyId === set.familyId) ?? [];
            if (rows.length === 0) return null;
            return { title: contrasts[set.familyId]?.name ?? rows[0].familyName ?? 'Family', ids: rows.map(r => r.id) };
        }
        case 'chapter': {
            const chapter = (await GrammarService.loadTeachingOrder())?.chapters.find(c => c.id === set.chapterId);
            if (!chapter) return null;
            const points = await GrammarService.loadGrammarPoints(chapter.points);
            return { title: chapter.title, ids: withSharedFamily(points, p => p.family?.id).map(p => p.id) };
        }
    }
}

/** The sets a point is drilled in, the default first: each lesson that covers it, then its whole family. */
async function setsOfPoint(grammarId: string, contrasts: GrammarContrastIndex): Promise<GroupSet[]> {
    const lessons = Object.entries(contrasts).flatMap(([familyId, entry]) =>
        entry.lessons.filter(l => l.points.includes(grammarId)).map((l): GroupSet => ({ kind: 'lesson', familyId, lessonId: l.id })));
    const point = await GrammarService.loadGrammarPoint(grammarId).catch(() => null);
    const family: GroupSet[] = point?.family ? [{ kind: 'family', familyId: point.family.id }] : [];
    return [...lessons, ...family];
}

/** A point's examples to drill on: its curated ones and its mined ones, each sentence once. */
async function sourceOf(point: GrammarPoint): Promise<DrillSource> {
    const mined = await GrammarService.loadMinedExamples(point.id);
    const seen = new Set<string>();
    const examples = [...point.examples, ...(mined ?? [])].filter(e => !seen.has(e.jp) && !!seen.add(e.jp));
    return { point, examples };
}

/** What a set (not a point's) is drilled on: its title, its points, its cases, and how its points are named. Null when it names nothing the dataset has. */
async function planOf(set: GroupSet, contrasts: GrammarContrastIndex) {
    const members = await membersOf(set, contrasts);
    if (!members) return null;
    const points = await GrammarService.loadGrammarPoints(members.ids);
    const ids = new Set(members.ids);
    const cases = Object.values(contrasts).flatMap(e => e.lessons.flatMap(l => l.cases)).filter(c => ids.has(c.focus));
    const info = (p: GrammarPoint): DrillPointInfo => {
        const family = p.family?.id;
        return {
            id: p.id, title: p.title, jlptLevel: p.jlptLevel, marker: markerTextOf(p) ?? p.title,
            ...(p.usageNote ? { usageNote: p.usageNote } : {}),
            comparedOn: family && (contrasts[family]?.lessons.length ?? 0) > 0 ? family : null,
        };
    };
    return { title: members.title, points, cases, info };
}

/** The sets a drill is built from: the set itself, or a point's sets in turn (with the point as focus), the first with cards winning. */
async function candidatesOf(set: DrillSet, contrasts: GrammarContrastIndex): Promise<{ set: GroupSet; focus?: string }[]> {
    if (set.kind !== 'point') return [{ set }];
    return (await setsOfPoint(set.grammarId, contrasts)).map(s => ({ set: s, focus: set.grammarId }));
}

/**
 * Loads and builds a drill. Null when the set does not exist or has nothing to drill
 * (fewer than two of its points have a sentence the dataset rules a sibling out of).
 * A point's drill is the first of its sets that has cards for the point.
 */
export async function loadDrill(set: DrillSet, seed: string): Promise<Drill | null> {
    const contrasts = await GrammarService.loadContrasts();
    for (const { set: candidate, focus } of await candidatesOf(set, contrasts)) {
        const plan = await planOf(candidate, contrasts);
        if (!plan) continue;
        const sources = await Promise.all(plan.points.map(sourceOf));
        const cards = drillCardsOf(sources, plan.cases, seed, plan.info, focus);
        if (cards.length === 0) continue;
        const lessons = set.kind === 'family' ? lessonsCovered(cards, contrasts[set.familyId]?.lessons ?? []) : undefined;
        return { title: plan.title, cards, points: Object.fromEntries(plan.points.map(p => [p.id, plan.info(p)])), ...(lessons ? { lessons } : {}) };
    }
    return null;
}

/**
 * Whether loadDrill would build a drill, for its button: the same rule, without the
 * whole build. A set's points are read one at a time (a point's mined examples are
 * the costly part), stopping at the first with a card. Independent of the seed, as
 * whether a drill has cards is.
 */
export async function hasDrill(set: DrillSet): Promise<boolean> {
    const contrasts = await GrammarService.loadContrasts();
    for (const { set: candidate, focus } of await candidatesOf(set, contrasts)) {
        const plan = await planOf(candidate, contrasts);
        if (!plan) continue;
        const ordered = [...plan.points].sort((a, b) => Number(b.id === focus) - Number(a.id === focus));
        for (const point of ordered) {
            if (pointCardsOf(await sourceOf(point), plan.points, plan.cases, '', plan.info, focus).length > 0) return true;
        }
    }
    return false;
}
