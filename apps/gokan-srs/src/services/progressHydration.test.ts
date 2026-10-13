import { describe, expect, it } from 'vitest';
import { hydrateKanjiKnowledge, parseStoredProgress, parseStoredSettings } from './progressHydration';
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
