import { describe, expect, it } from 'vitest';
import { hydrateKanjiKnowledge, hydrateMixups, parseStoredProgress, parseStoredSettings } from './progressHydration';
import { DEFAULT_SETTINGS } from '../models/user.model';

describe('parseStoredSettings', () => {
    it('loads settings stored with the retired answerColors key', () => {
        const stored = JSON.stringify({ preferredLearningOrder: 'kklc', learningFrequency: 'low', answerColors: 'colorblind' });
        expect(parseStoredSettings(stored, DEFAULT_SETTINGS)).toMatchObject({
            ...DEFAULT_SETTINGS,
            preferredLearningOrder: 'kklc',
            learningFrequency: 'low',
        });
    });
});

describe('hydrateKanjiKnowledge', () => {
    it('keeps a method the dataset lists, and reads any other as KKLC', () => {
        expect(hydrateKanjiKnowledge({ method: 'rtk', step: 800, kanjiSet: ['一'] })).toEqual({ method: 'rtk', step: 800, kanjiSet: new Set(['一']) });
        const stored = parseStoredProgress('{"kanjiKnowledge":{"method":"custom","step":3,"kanjiSet":[]}}');
        expect(hydrateKanjiKnowledge(stored.kanjiKnowledge).method).toBe('kklc');
        expect(hydrateKanjiKnowledge(undefined)).toEqual({ method: 'kklc', step: 0, kanjiSet: new Set() });
    });
});

describe('hydrateMixups', () => {
    it('keeps whole records and drops ones that cannot be shown or merged', () => {
        expect(hydrateMixups([
            { asked: 'a', answer: 'ひかる', outcome: 'accepted', typed: 'b', meaning: 'shine', cue: 'Her eyes shone.', date: 1 },
            { asked: 'a', answer: 'てらす', outcome: 'wrong', date: 2 },
            { asked: 'a', answer: 'てらす', outcome: 'wrong' },
            { answer: 'てらす', outcome: 'wrong', date: 3 },
            { asked: 'a', outcome: 'neutral', typed: 'b', date: 4 },
        ])).toEqual([
            { asked: 'a', answer: 'ひかる', outcome: 'accepted', typed: 'b', meaning: 'shine', cue: 'Her eyes shone.', date: 1 },
            { asked: 'a', answer: 'てらす', outcome: 'wrong', date: 2 },
        ]);
    });

    it('drops a record without an outcome: it predates issue #162 and cannot say where it happened', () => {
        const stored: unknown = JSON.parse('[{"asked":"a","typed":"b","tier":"confusable","shared":["shine"],"date":1},{"asked":"a","answer":"てらす","date":2},{"asked":"a","answer":"x","outcome":"later","date":3}]');
        expect(hydrateMixups(parseStoredProgress(JSON.stringify({ mixups: stored })).mixups)).toEqual([]);
    });

    it('leaves absent progress absent', () => {
        expect(hydrateMixups(undefined)).toBeUndefined();
    });
});
