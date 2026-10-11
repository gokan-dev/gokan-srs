import { describe, expect, it } from 'vitest';
import { parseStoredSettings } from './progressHydration';
import { DEFAULT_SETTINGS } from '../models/user.model';

describe('parseStoredSettings', () => {
    it('defaults answerColors for settings stored before the option existed', () => {
        const stored = JSON.stringify({ preferredLearningOrder: 'kklc', learningFrequency: 'low' });
        expect(parseStoredSettings(stored, DEFAULT_SETTINGS).answerColors).toBe('default');
    });

    it('keeps a stored answerColors choice', () => {
        const stored = JSON.stringify({ answerColors: 'colorblind' });
        expect(parseStoredSettings(stored, DEFAULT_SETTINGS).answerColors).toBe('colorblind');
    });
});
