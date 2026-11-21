import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GrammarContrastCase, GrammarContrastIndex, GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
import { grammarExample, grammarPoint } from '../../test/fixtures';
import { CONSTANTS } from '../../commons/constants';
import { GrammarService } from '../../services/grammar.service';
import type { DrillPointInfo, DrillSet } from '../../models/grammar.model';
import { caseFor, drillCardsOf, drillSummary, hasDrill, interleave, loadDrill, optionPointsOf, pickOf, rulesOut, withSharedFamily } from './drillSelectors';
import type { DrillSource } from './drillSelectors';

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
    cards.filter(c => c.point.id === pointId).map(c => optionPointsOf(c).sort());
/** A card's wrong options, by the text the learner picks. */
const choicesOf = (card: ReturnType<typeof drillCardsOf>[number]) => card.slots[0].choices ?? [];

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
            expect(card).toMatchObject({ kind: 'grammar-choice', mode: 'drill', host: { kind: 'grammar', grammarId: card.point.id } });
            // The right option is the one with no point of another: the asked point's.
            expect(choicesOf(card).filter(c => !c.pointId).map(c => c.text)).toEqual(card.slots[0].accept);
            expect(choicesOf(card).filter(c => c.pointId).every(c => c.note)).toBe(true);
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
        expect(choicesOf(card).filter(c => c.contrast).map(c => [c.pointId, c.contrast])).toEqual([['kara', fits]]);
        const back = drillCardsOf(sourcesOf(kara, karadesu), [{ ...fits, focus: 'karadesu', vs: ['kara'] }], 'seed', info);
        const asKara = back.find(c => c.point.id === 'kara');
        expect(asKara && choicesOf(asKara).find(c => c.pointId === 'karadesu')?.contrast?.focus).toBe('karadesu');
    });

    it('offers only points of the asked point\'s family: a chapter mixes families, and another family\'s point is no contrast', () => {
        const other = { id: 'contradiction', name: 'But', relatedPoints: [] };
        const demo = point('demo', 'でも', [example(['でも', '、', '行く'], [0])], { slot: 'sentence-initial', family: other });
        const kedo = point('kedo', 'けど', [example(['高い', 'けど', '、', '買う'], [1])], { slot: 'clause-final', family: other });
        const desuga = point('desuga', 'ですが', [example(['雨', 'ですが', '、', '行く'], [1])], { slot: 'predicate-final', family: other });
        const sources = sourcesOf(kara, karadesu, demo, kedo, desuga);
        const familyOf = new Map(sources.map(s => [s.point.id, s.point.family?.id]));
        const chapter = drillCardsOf(sources, [], 'seed', info);
        expect(chapter.length).toBeGreaterThan(0);
        for (const card of chapter) {
            expect(new Set(optionPointsOf(card).map(id => familyOf.get(id)))).toEqual(new Set([familyOf.get(card.point.id)]));
        }
        // でも (sentence-initial) would rule から out by slot alone: it is never offered on から's card.
        expect(optionsOf(chapter, 'kara')).toEqual([['kara', 'karadesu'], ['kara', 'karadesu']]);
    });

    it('builds a point\'s drill around the point under any seed, even past drillMaxCards points', () => {
        // Fourteen points of one family, alternating between two places of a sentence: each rules the other half out.
        const markers = ['から', 'ので', 'ため', 'おかげで', 'せいで', 'し', 'て', 'からです', 'のです', 'ためです', 'わけです', 'ものだ', 'ことだ', 'はずだ'];
        const many = markers.map((m, i) => point(`p${i}`, m, [example(['雨', m], [1]), example(['風', m], [1])], { slot: i % 2 === 0 ? 'clause-final' : 'predicate-final' }));
        const sources = sourcesOf(...many);
        let cutSomewhere = false;
        for (const seed of Array.from({ length: 30 }, (_, i) => `seed-${i}`)) {
            if (!drillCardsOf(sources, [], seed, info).some(c => c.point.id === 'p13')) cutSomewhere = true;
            const cards = drillCardsOf(sources, [], seed, info, 'p13');
            expect(cards.length).toBeGreaterThan(0);
            expect(cards[0].point.id).toBe('p13');
            for (const card of cards) expect(optionPointsOf(card)).toContain('p13');
        }
        // Without the focus the cap cuts the point's own cards under some seeds: the case this guards.
        expect(cutSomewhere).toBe(true);
    });

    it('has no point drill for a point with no card of its own', () => {
        // おかげで rules から out, but without からです nothing rules a sibling out of から's examples.
        expect(drillCardsOf(sourcesOf(okage, kara, karadesu), [], 'seed', info, 'kara')).not.toEqual([]);
        expect(drillCardsOf(sourcesOf(okage, kara), [], 'seed', info, 'kara')).toEqual([]);
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

describe('pickOf', () => {
    const [card] = drillCardsOf(sourcesOf(kara, karadesu), [], 'seed', info).filter(c => c.point.id === 'kara');
    it('names the point of the option picked, read from the card itself', () => {
        const wrong = choicesOf(card).find(c => c.pointId);
        expect(pickOf(card, wrong?.text ?? '', false)).toEqual({ asked: 'kara', picked: 'karadesu', right: false });
        expect(pickOf(card, card.slots[0].accept[0], true)).toEqual({ asked: 'kara', picked: 'kara', right: true });
        expect(pickOf(card, 'まったく違う', false)).toEqual({ asked: 'kara', picked: null, right: false });
    });
});

describe('hasDrill', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    const all = [kara, node, karadesu, okage];
    const contrasts: GrammarContrastIndex = {
        reason: {
            name: 'Reason',
            lessons: [
                { id: 'core', title: 'から / からです', points: ['kara', 'node', 'karadesu'], cases: [] },
                // から and ので may both fit everywhere: nothing to drill.
                { id: 'alike', title: 'から / ので', points: ['kara', 'node'], cases: [] },
                { id: 'credit', title: 'おかげで / から', points: ['okage', 'kara'], cases: [] },
            ],
        },
    };
    const mockDataset = () => {
        vi.spyOn(GrammarService, 'loadContrasts').mockResolvedValue(contrasts);
        vi.spyOn(GrammarService, 'loadGrammarPoints').mockImplementation(ids => Promise.resolve(all.filter(p => ids.includes(p.id))));
        vi.spyOn(GrammarService, 'loadGrammarPoint').mockImplementation(id => {
            const found = all.find(p => p.id === id);
            return found ? Promise.resolve(found) : Promise.reject(new Error('missing'));
        });
        vi.spyOn(GrammarService, 'loadMinedExamples').mockResolvedValue(null);
        vi.spyOn(GrammarService, 'loadTeachingOrder').mockResolvedValue({ order: [], chapters: [{ id: 'c1', title: 'Reasons', summary: '', jlptLevel: 5, points: ['kara', 'karadesu'] }] });
    };

    it('agrees with loadDrill on every set, whatever its seed', async () => {
        mockDataset();
        const sets: DrillSet[] = [
            { kind: 'lesson', familyId: 'reason', lessonId: 'core' },
            { kind: 'lesson', familyId: 'reason', lessonId: 'alike' },
            { kind: 'lesson', familyId: 'reason', lessonId: 'credit' },
            { kind: 'lesson', familyId: 'reason', lessonId: 'none' },
            { kind: 'chapter', chapterId: 'c1' },
            ...all.map((p): DrillSet => ({ kind: 'point', grammarId: p.id })),
        ];
        const answers = await Promise.all(sets.map(async set => [await hasDrill(set), (await loadDrill(set, 'x')) !== null, (await loadDrill(set, 'y')) !== null]));
        for (const [has, built, again] of answers) {
            expect(built).toBe(has);
            expect(again).toBe(has);
        }
        // Both answers occur, so the agreement says something.
        expect(new Set(answers.map(([has]) => has))).toEqual(new Set([true, false]));
    });

    it('stops reading points once two have a card', async () => {
        mockDataset();
        const mined = vi.spyOn(GrammarService, 'loadMinedExamples').mockResolvedValue(null);
        expect(await hasDrill({ kind: 'lesson', familyId: 'reason', lessonId: 'core' })).toBe(true);
        // から and ので come first; ので has none of its own here (からです only rules out by slot, ので has the same slot as から), so からです is read too.
        expect(mined.mock.calls.length).toBeLessThanOrEqual(3);
    });
});
