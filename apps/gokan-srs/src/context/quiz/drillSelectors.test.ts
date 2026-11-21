import { describe, expect, it } from 'vitest';
import type { GrammarContrastCase, GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
import { grammarExample, grammarPoint } from '../../test/fixtures';
import { CONSTANTS } from '../../commons/constants';
import { caseFor, drillCardsOf, drillSummary, interleave, rulesOut, withSharedFamily } from './drillSelectors';
import type { DrillPointInfo, DrillSource } from './drillSelectors';

/** An example written as its tokens, the pattern at `pattern`. */
const example = (tokens: string[], pattern: number[], ruledOut?: string[]): GrammarExample => grammarExample({
    jp: tokens.join(''),
    words: tokens.map(surface => ({ surface, vocabId: null })),
    patternWordIndices: pattern,
    ...(ruledOut ? { ruledOut } : {}),
});

const point = (id: string, title: string, examples: GrammarExample[], overrides: Partial<GrammarPoint> = {}): GrammarPoint =>
    grammarPoint({ id, title, formation: `Clause + ${title}`, examples, family: { id: 'reason', name: 'Reason', relatedPoints: [] }, ...overrides });

// から and ので stand in the same place of a sentence: either may fit, so neither is
// ever the other's wrong answer. からです ends a sentence, so it never fits theirs.
// おかげで has no slot authored; its sentence rules から out by connection.
const kara = point('kara', 'から', [example(['雨', 'だ', 'から', '、', '行かない'], [2]), example(['暑い', 'から', '、', '泳ぐ'], [1])], { slot: 'clause-final' });
const node = point('node', 'ので', [example(['雨', 'な', 'ので', '、', '行かない'], [2])], { slot: 'clause-final' });
const karadesu = point('karadesu', 'からです', [example(['雨', 'だ', 'からです'], [2])], { slot: 'predicate-final' });
const okage = point('okage', 'おかげで', [example(['先生', 'の', 'おかげで', '、', '合格した'], [2], ['kara'])]);

const info = (p: GrammarPoint): DrillPointInfo => ({ id: p.id, title: p.title, jlptLevel: p.jlptLevel, marker: p.title, comparedOn: 'reason' });
const sourcesOf = (...points: GrammarPoint[]): DrillSource[] => points.map(p => ({ point: p, examples: p.examples }));
const optionsOf = (cards: ReturnType<typeof drillCardsOf>, pointId: string) =>
    cards.filter(c => c.point.id === pointId).map(c => c.options.map(o => o.pointId).sort());

describe('rulesOut', () => {
    it('rules a sibling out where its example says so, or where the two are authored to stand in different places', () => {
        expect(rulesOut(okage, kara, okage.examples[0])).toBe(true);
        expect(rulesOut(kara, karadesu, kara.examples[0])).toBe(true);
    });

    it('never rules out a sibling that might fit: the same place, or nothing authored', () => {
        expect(rulesOut(kara, node, kara.examples[0])).toBe(false);
        expect(rulesOut(okage, node, okage.examples[0])).toBe(false);
        expect(rulesOut(kara, okage, kara.examples[0])).toBe(false);
    });
});

describe('drillCardsOf', () => {
    const cards = drillCardsOf(sourcesOf(kara, node, karadesu, okage), [], 'seed', info);

    it('offers as wrong answers only the points the dataset rules out there', () => {
        expect(optionsOf(cards, 'kara')).toEqual([['kara', 'karadesu'], ['kara', 'karadesu']]);
        expect(optionsOf(cards, 'node')).toEqual([['karadesu', 'node']]);
        expect(optionsOf(cards, 'karadesu')).toEqual([['kara', 'karadesu', 'node']]);
        expect(optionsOf(cards, 'okage')).toEqual([['kara', 'okage']]);
    });

    it('asks each card as a choice through the engine, in drill mode, the right option the example\'s own pattern', () => {
        for (const card of cards) {
            expect(card.exercise).toMatchObject({ kind: 'grammar-choice', mode: 'drill', host: { kind: 'grammar', grammarId: card.point.id } });
            expect(card.exercise.slots[0].accept).toEqual([card.options[0].text]);
            expect(card.exercise.slots[0].choices?.map(c => c.text).sort()).toEqual(card.options.map(o => o.text).sort());
        }
    });

    it('meets every point, never the same one twice in a row', () => {
        expect(new Set(cards.map(c => c.point.id))).toEqual(new Set(['kara', 'node', 'karadesu', 'okage']));
        cards.forEach((card, i) => { if (i > 0) expect(card.point.id).not.toBe(cards[i - 1].point.id); });
        expect(cards).toHaveLength(5);
    });

    it('stops at drillMaxCards', () => {
        const many = (id: string, title: string, slot: GrammarPoint['slot']) =>
            point(id, title, Array.from({ length: 10 }, (_, i) => example([`文${i}`, title], [1])), { slot });
        const long = drillCardsOf(sourcesOf(many('a', 'から', 'clause-final'), many('b', 'からです', 'predicate-final')), [], 'seed', info);
        expect(long).toHaveLength(CONSTANTS.srs.grammar.drillMaxCards);
    });

    it('has nothing to drill when fewer than two points have a card', () => {
        expect(drillCardsOf(sourcesOf(kara, node), [], 'seed', info)).toEqual([]);
        expect(drillCardsOf(sourcesOf(okage, node), [], 'seed', info)).toEqual([]);
    });

    it('carries the contrast case that covers a wrong option, either way round', () => {
        const fits: GrammarContrastCase = { focus: 'okage', vs: ['kara'], situation: 'Thanks to someone.', guidance: 'おかげで credits them.' };
        const [card] = drillCardsOf(sourcesOf(okage, karadesu, kara), [fits], 'seed', info).filter(c => c.point.id === 'okage');
        expect(card.cases).toEqual({ kara: fits });
        const back = drillCardsOf(sourcesOf(kara, karadesu), [{ ...fits, focus: 'karadesu', vs: ['kara'] }], 'seed', info);
        expect(back.find(c => c.point.id === 'kara')?.cases.karadesu?.focus).toBe('karadesu');
    });
});

describe('caseFor', () => {
    const cases: GrammarContrastCase[] = [
        { focus: 'b', vs: ['a'], situation: 'b over a', guidance: '' },
        { focus: 'a', vs: ['b', 'c'], situation: 'a over b', guidance: '' },
    ];
    it('prefers the case where the asked point fits, then the one the other way round', () => {
        expect(caseFor('a', 'b', cases)?.situation).toBe('a over b');
        expect(caseFor('b', 'c', cases)).toBeUndefined();
        expect(caseFor('c', 'a', cases)?.situation).toBe('a over b');
    });
});

describe('interleave', () => {
    it('meets every group first, then the one with most left, never the same twice in a row', () => {
        const out = interleave([{ key: 'a', items: ['a1', 'a2', 'a3', 'a4'] }, { key: 'b', items: ['b1'] }, { key: 'c', items: ['c1', 'c2'] }], 12);
        expect(out).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
    });

    it('stops at the cap', () => {
        expect(interleave([{ key: 'a', items: [1, 2, 3] }, { key: 'b', items: [4, 5, 6] }], 3)).toEqual([1, 4, 2]);
    });
});

describe('withSharedFamily', () => {
    it('keeps only the items sharing a family with another', () => {
        const items = [{ id: 1, f: 'x' }, { id: 2, f: 'y' }, { id: 3, f: 'x' }, { id: 4, f: undefined }];
        expect(withSharedFamily(items, i => i.f).map(i => i.id)).toEqual([1, 3]);
        expect(withSharedFamily([{ f: 'x' }, { f: 'y' }], i => i.f)).toEqual([]);
    });
});

describe('drillSummary', () => {
    it('counts the right answers and the pairs confused, most often first', () => {
        const summary = drillSummary([
            { asked: 'node', picked: 'kara', right: false },
            { asked: 'kara', picked: 'kara', right: true },
            { asked: 'okage', picked: 'kara', right: false },
            { asked: 'okage', picked: 'kara', right: false },
            { asked: 'node', picked: null, right: false },
        ]);
        expect(summary).toEqual({
            right: 1,
            total: 5,
            confusions: [{ asked: 'okage', picked: 'kara', times: 2 }, { asked: 'node', picked: 'kara', times: 1 }],
        });
    });
});
