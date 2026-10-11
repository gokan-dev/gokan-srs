import { describe, it, expect } from 'vitest';
import { grammarSummaryOf, groupByLevel, inTeachingOrder } from './grammarBrowse';
import { grammarPoint } from '../test/fixtures';

describe('grammarSummaryOf', () => {
    it('keeps what a list row shows, the explanation cut short', () => {
        const point = grammarPoint({
            id: 'n5-073',
            title: 'から',
            jlptLevel: 5,
            romaji: 'kara',
            shortExplanation: 'Because, since; used to give a reason that the speaker considers subjective or personal.',
        });
        expect(grammarSummaryOf(point)).toEqual({
            id: 'n5-073',
            title: 'から',
            jlptLevel: 5,
            romaji: 'kara',
            shortExplanation: 'Because, since; used to give a reason that the speaker…',
        });
    });

    it('leaves romaji out when the point has none', () => {
        expect(grammarSummaryOf(grammarPoint({ romaji: undefined }))).not.toHaveProperty('romaji');
    });
});

describe('inTeachingOrder', () => {
    it('orders points as the curriculum teaches them, points outside it last', () => {
        const points = ['a', 'b', 'c', 'variant'].map(id => grammarPoint({ id }));
        expect(inTeachingOrder(points, ['c', 'a', 'b']).map(p => p.id)).toEqual(['c', 'a', 'b', 'variant']);
    });
});

describe('groupByLevel', () => {
    it('groups N5 first, keeping the order within a level and leaving empty levels out', () => {
        const items = [{ id: 'x', jlptLevel: 3 }, { id: 'y', jlptLevel: 5 }, { id: 'z', jlptLevel: 3 }];
        expect(groupByLevel(items)).toEqual([
            { level: 5, items: [{ id: 'y', jlptLevel: 5 }] },
            { level: 3, items: [{ id: 'x', jlptLevel: 3 }, { id: 'z', jlptLevel: 3 }] },
        ]);
    });
});
