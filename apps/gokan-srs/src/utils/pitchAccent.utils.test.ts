import { describe, expect, it } from 'vitest';
import { downstepLabel, pitchAccentLabel } from './pitchAccent.utils';

describe('pitchAccentLabel', () => {
    it('names heiban and says where any other pattern drops', () => {
        expect(downstepLabel(0)).toBe('heiban');
        expect(downstepLabel(2)).toBe('drop after mora 2');
    });

    it('lists several patterns, most usual first', () => {
        expect(pitchAccentLabel([0])).toBe('Pitch accent: heiban');
        expect(pitchAccentLabel([4, 3])).toBe('Pitch accent: drop after mora 4, or drop after mora 3');
    });
});
