import { describe, expect, it } from 'vitest';
import { learningCurve } from './learningCurve.utils';
import { reviewLog, srsEntry } from '../test/fixtures';
import { CONSTANTS } from '../commons/constants';
import { calculateMasteryLoops } from './srs.utils';

describe('learningCurve', () => {
    const introducedAt = new Date(1_000);
    const now = 10_000;

    it('starts at 0 on introduction and ends at the current strength now', () => {
        const entry = srsEntry({ memoryStrength: 20 });
        const curve = learningCurve(entry, introducedAt, now);
        expect(curve[0]).toEqual({ date: 1_000, percent: 0 });
        expect(curve.at(-1)).toEqual({ date: now, percent: calculateMasteryLoops(20).p1 });
    });

    it('reads each review\'s strength back off its interval, in date order', () => {
        const strength = 50;
        const entry = srsEntry({
            memoryStrength: strength,
            history: [
                reviewLog({ date: 3_000, interval: strength * CONSTANTS.srs.formula.lnTarget }),
                reviewLog({ date: 2_000, interval: 0.5 }),
            ],
        });
        const curve = learningCurve(entry, introducedAt, now);
        expect(curve.map(p => p.date)).toEqual([1_000, 2_000, 3_000, now]);
        expect(curve[2].percent).toBeCloseTo(calculateMasteryLoops(strength).p1, 6);
        expect(curve[1].percent).toBeLessThan(curve[2].percent);
    });

    it('never exceeds 100', () => {
        const entry = srsEntry({ memoryStrength: 600, history: [reviewLog({ date: 2_000, interval: 3650 })] });
        expect(Math.max(...learningCurve(entry, null, now).map(p => p.percent))).toBe(100);
    });
});
