import { describe, it, expect } from 'vitest';
import type { ConjugationDrillItem, GrammarConjugationIndex, GrammarPoint } from '@gokan/dataset-schema';
import { conjugationTables } from './grammarConjugations';
import { grammarPoint } from '../test/fixtures';

const VERB: ConjugationDrillItem = { vocabId: '1', lemma: '書く', lemmaReading: 'かく', target: '書いた', targetReading: 'かいた', wordClass: 'godan' };
const ADJ: ConjugationDrillItem = { vocabId: '2', lemma: '高い', lemmaReading: 'たかい', target: '高かった', targetReading: 'たかかった', wordClass: 'i-adjective' };
const NA: ConjugationDrillItem = { vocabId: '3', lemma: '静か', lemmaReading: 'しずか', target: '静かだった', targetReading: 'しずかだった', wordClass: 'na-adjective' };

function points(...list: GrammarPoint[]): Map<string, GrammarPoint> {
    return new Map(list.map(point => [point.id, point]));
}

describe('conjugationTables', () => {
    it('groups forms by word type, verbs first, with a pattern and an example', () => {
        const conjugations: GrammarConjugationIndex = {
            'n5-909': { form: 'i-adj-past', formLabel: 'past (かった)', items: [ADJ] },
            'n5-905': { form: 'plain-past', formLabel: 'plain past (た)', items: [VERB, { ...VERB, wordClass: 'ichidan' }] },
            'n5-912': { form: 'na-adj-past', formLabel: 'plain past (だった)', items: [NA] },
        };
        const tables = conjugationTables(conjugations, points(
            grammarPoint({ id: 'n5-909', title: 'Past: い-Adjective かった' }),
            grammarPoint({ id: 'n5-905', title: 'Plain past: Verb た' }),
            grammarPoint({ id: 'n5-912', title: 'Plain past: な-Adjective だった' }),
        ));
        expect(tables.map(t => t.wordType)).toEqual(['verb', 'i-adjective', 'na-adjective']);
        expect(tables[0].rows).toEqual([
            { id: 'n5-905', formLabel: 'plain past (た)', pattern: 'Verb た', jlptLevel: 5, example: { lemma: '書く', target: '書いた' } },
        ]);
    });

    it('orders rows easiest level first, then by point id', () => {
        const conjugations: GrammarConjugationIndex = {
            'n4-021': { form: 'causative', formLabel: 'causative', items: [VERB] },
            'n5-906': { form: 'plain-negative', formLabel: 'plain negative', items: [VERB] },
            'n5-905': { form: 'plain-past', formLabel: 'plain past', items: [VERB] },
        };
        const tables = conjugationTables(conjugations, points(
            grammarPoint({ id: 'n4-021', jlptLevel: 4 }), grammarPoint({ id: 'n5-906' }), grammarPoint({ id: 'n5-905' }),
        ));
        expect(tables[0].rows.map(r => r.id)).toEqual(['n5-905', 'n5-906', 'n4-021']);
    });

    it('drops a stale point id and leaves out empty word types', () => {
        const conjugations: GrammarConjugationIndex = { gone: { form: 'te', formLabel: 'te-form', items: [VERB] } };
        expect(conjugationTables(conjugations, points())).toEqual([]);
    });
});
