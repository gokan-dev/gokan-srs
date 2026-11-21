// src/context/quiz/drillSelectors.ts
//
// The contrast drill (issue #249): a short quiz over one set of similar grammar
// points, open to every learner on every point, that never touches the SRS. Each
// card is a grammar-choice exercise in `drill` mode, so it runs on the exercise
// engine like any other, and effectsOf decides nothing for it.
import type { GrammarContrastCase, GrammarContrastIndex, GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
import { CONSTANTS } from '../../commons/constants';
import { GrammarService } from '../../services/grammar.service';
import { choiceSlot } from '../../services/exercise/slots';
import type { Exercise } from '../../services/exercise/types';
import { grammarClozeSentence } from '../../utils/clozeSentence.utils';
import { hashString } from '../../utils/deterministicPick';
import { choiceDistractors, patternTextOf } from './grammarSelectors';

/** What can be drilled: a lesson (the set meant for it), a whole family, a chapter, or a point against its siblings. */
export type DrillSet =
    | { kind: 'lesson'; familyId: string; lessonId: string }
    | { kind: 'family'; familyId: string }
    | { kind: 'chapter'; chapterId: string }
    | { kind: 'point'; grammarId: string };

/** A point of the drill, as its cards and its summary name it. */
export interface DrillPointInfo extends Pick<GrammarPoint, 'id' | 'title' | 'jlptLevel' | 'usageNote'> {
    /** The family page that compares it, when its family has lessons there; null otherwise. */
    comparedOn: string | null;
}

/** An option of a drill card, with the point it is the marker of. */
export interface DrillOption {
    text: string;
    pointId: string;
}

export interface DrillCard {
    exercise: Extract<Exercise, { kind: 'grammar-choice' }>;
    /** The point whose example this is: the right answer. */
    point: DrillPointInfo;
    /** Every option, the right one first. */
    options: DrillOption[];
    /** The contrast case that covers the right point against a wrong option, keyed by that option's point id. */
    cases: Record<string, GrammarContrastCase>;
}

export interface Drill {
    title: string;
    cards: DrillCard[];
    /** Every point an option names, for the summary. */
    points: Record<string, DrillPointInfo>;
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

/** A drill being answered: the card on screen (`index`; past the last one, the summary) and what was picked so far. */
export interface DrillRun {
    drill: Drill;
    index: number;
    picks: DrillPick[];
}

/** The card on screen, or null once every card is answered. */
export function currentDrillCard(run: DrillRun | null): DrillCard | null {
    return run?.drill.cards[run.index] ?? null;
}

/** What one answered card is for the summary: the point whose option was picked, if the answer is one. */
export function pickOf(card: DrillCard, answer: string, right: boolean): DrillPick {
    return { asked: card.point.id, picked: card.options.find(o => o.text === answer)?.pointId ?? null, right };
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

/** One card: the example's pattern blanked, picked among the set's points the dataset rules out there. Null when none is. */
function drillCardOf(source: DrillSource, exampleIndex: number, set: readonly GrammarPoint[], cases: readonly GrammarContrastCase[], info: (p: GrammarPoint) => DrillPointInfo): DrillCard | null {
    const { point } = source;
    const example = source.examples[exampleIndex];
    const answer = patternTextOf(example);
    if (!answer) return null;
    const seed = `${point.id}:${example.jp}`;
    const siblings = set.filter(s => s.id !== point.id && rulesOut(point, s, example));
    const distractors = choiceDistractors(answer, siblings, seed).slice(0, CONSTANTS.srs.grammar.maxChoiceDistractors);
    if (distractors.length === 0) return null;

    const span = [...example.patternWordIndices].sort((a, b) => a - b);
    const cardCases: Record<string, GrammarContrastCase> = {};
    for (const d of distractors) {
        const found = caseFor(point.id, d.pointId, cases);
        if (found) cardCases[d.pointId] = found;
    }
    return {
        exercise: {
            kind: 'grammar-choice',
            mode: 'drill',
            host: { kind: 'grammar', grammarId: point.id },
            label: point.title,
            slots: [choiceSlot({ answer, distractors: distractors.map(({ text, note }) => ({ text, note })), role: 'core', seed })],
            cue: {},
            sentence: grammarClozeSentence(example, [span], `drill:${point.id}:${exampleIndex}`),
        },
        point: info(point),
        options: [{ text: answer, pointId: point.id }, ...distractors.map(({ text, pointId }) => ({ text, pointId }))],
        cases: cardCases,
    };
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
 * The drill's cards over a set of points: one pass over every usable example,
 * interleaved so every point is met and never twice in a row, capped at
 * drillMaxCards. An example is usable when its pattern is located and at least one
 * other point of the set is ruled out there (rulesOut): only those are offered as
 * wrong answers. Empty when fewer than two points have a usable example: there is
 * nothing to tell apart. `seed` orders points and sentences, so a drill run again
 * can come out differently without the builder reading a clock.
 */
export function drillCardsOf(sources: readonly DrillSource[], cases: readonly GrammarContrastCase[], seed: string, info: (p: GrammarPoint) => DrillPointInfo): DrillCard[] {
    const set = sources.map(s => s.point);
    const groups = sources.map(source => {
        const cards = source.examples
            .map((_, i) => drillCardOf(source, i, set, cases, info))
            .filter(c => c !== null)
            .sort((a, b) => hashString(`${seed}:${a.exercise.sentence.sentence.original}`) - hashString(`${seed}:${b.exercise.sentence.sentence.original}`));
        return { key: source.point.id, items: cards };
    }).filter(g => g.items.length > 0)
        .sort((a, b) => hashString(`${seed}:${a.key}`) - hashString(`${seed}:${b.key}`));
    if (groups.length < 2) return [];
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

/** The point ids a set covers, and its title. Null when the set names nothing the dataset has. */
async function membersOf(set: DrillSet, contrasts: GrammarContrastIndex): Promise<{ title: string; ids: string[] } | null> {
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
        case 'point':
            // Resolved by loadDrill into the lessons and family it belongs to.
            return null;
    }
}

/** The sets a point is drilled in, the default first: each lesson that covers it, then its whole family. */
async function setsOfPoint(grammarId: string, contrasts: GrammarContrastIndex): Promise<DrillSet[]> {
    const lessons = Object.entries(contrasts).flatMap(([familyId, entry]) =>
        entry.lessons.filter(l => l.points.includes(grammarId)).map((l): DrillSet => ({ kind: 'lesson', familyId, lessonId: l.id })));
    const point = await GrammarService.loadGrammarPoint(grammarId).catch(() => null);
    const family: DrillSet[] = point?.family ? [{ kind: 'family', familyId: point.family.id }] : [];
    return [...lessons, ...family];
}

/** A point's examples to drill on: its curated ones and its mined ones, each sentence once. */
async function sourceOf(point: GrammarPoint): Promise<DrillSource> {
    const mined = await GrammarService.loadMinedExamples(point.id);
    const seen = new Set<string>();
    const examples = [...point.examples, ...(mined ?? [])].filter(e => !seen.has(e.jp) && !!seen.add(e.jp));
    return { point, examples };
}

/**
 * Loads and builds a drill. Null when the set does not exist or has nothing to drill
 * (fewer than two of its points have a sentence the dataset rules a sibling out of).
 * A point's drill is the first of its sets that has one, and that covers the point.
 */
export async function loadDrill(set: DrillSet, seed: string): Promise<Drill | null> {
    const contrasts = await GrammarService.loadContrasts();
    if (set.kind === 'point') {
        for (const candidate of await setsOfPoint(set.grammarId, contrasts)) {
            const drill = await loadDrill(candidate, seed);
            if (drill?.cards.some(c => c.point.id === set.grammarId)) return drill;
        }
        return null;
    }

    const members = await membersOf(set, contrasts);
    if (!members) return null;
    const points = await GrammarService.loadGrammarPoints(members.ids);
    const sources = await Promise.all(points.map(sourceOf));
    const ids = new Set(members.ids);
    const cases = Object.values(contrasts).flatMap(e => e.lessons.flatMap(l => l.cases)).filter(c => ids.has(c.focus));
    const info = (p: GrammarPoint): DrillPointInfo => {
        const family = p.family?.id;
        return {
            id: p.id, title: p.title, jlptLevel: p.jlptLevel,
            ...(p.usageNote ? { usageNote: p.usageNote } : {}),
            comparedOn: family && (contrasts[family]?.lessons.length ?? 0) > 0 ? family : null,
        };
    };
    const cards = drillCardsOf(sources, cases, seed, info);
    if (cards.length === 0) return null;
    return { title: members.title, cards, points: Object.fromEntries(points.map(p => [p.id, info(p)])) };
}
