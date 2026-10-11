import { describe, expect, it } from 'vitest';
import { parseStoredSettings } from './progressHydration';
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
