import { describe, expect, it } from 'vitest';
import { hydrateKanjiKnowledge, hydrateMixups, parseStoredProgress, parseStoredSettings } from './progressHydration';
import { DEFAULT_SETTINGS, PACING_EPOCH } from '../models/user.model';

describe('parseStoredSettings', () => {
    it('loads settings stored with the retired answerColors key', () => {
        const stored = JSON.stringify({ preferredLearningOrder: 'kklc', learningFrequency: 'low', answerColors: 'colorblind' });
        expect(parseStoredSettings(stored, DEFAULT_SETTINGS)).toMatchObject({
            ...DEFAULT_SETTINGS,
            preferredLearningOrder: 'kklc',
            intervalModifier: 2.0,
            intervalModifierHistory: [{ from: PACING_EPOCH, value: 2.0 }],
        });
    });

    it('migrates each stored preset to its exact multiplier, seeding the history from the epoch', () => {
        for (const [preset, multiplier] of [['high', 1.0], ['medium', 1.5], ['low', 2.0]] as const) {
            const settings = parseStoredSettings(JSON.stringify({ learningFrequency: preset }), DEFAULT_SETTINGS);
            expect(settings.intervalModifier).toBe(multiplier);
            expect(settings.intervalModifierHistory).toEqual([{ from: PACING_EPOCH, value: multiplier }]);
        }
    });

    it('defaults pacing when nothing is stored, and keeps a stored history as it is', () => {
        expect(parseStoredSettings('{}', DEFAULT_SETTINGS).intervalModifier).toBe(1.5);
        expect(parseStoredSettings(JSON.stringify({ learningFrequency: 'nonsense' }), DEFAULT_SETTINGS).intervalModifier).toBe(1.5);
        const history = [{ from: PACING_EPOCH, value: 2 }, { from: '2026-11-01T00:00:00.000Z', value: 3.2 }];
        const settings = parseStoredSettings(JSON.stringify({ learningFrequency: 'low', intervalModifier: 3.2, intervalModifierHistory: history }), DEFAULT_SETTINGS);
        expect(settings.intervalModifier).toBe(3.2);
        expect(settings.intervalModifierHistory).toEqual(history);
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
