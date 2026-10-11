import { describe, expect, it } from 'vitest';
import { hubPrimaryActivity, hubSummary } from './hub.utils';

const none = { review: 0, new: 0, retries: 0 };

describe('hubPrimaryActivity', () => {
    it('picks vocabulary first when it has any work', () => {
        expect(hubPrimaryActivity({ ...none, review: 3 }, { ...none, review: 9 })).toBe('vocab');
        expect(hubPrimaryActivity({ ...none, new: 1 }, none)).toBe('vocab');
        expect(hubPrimaryActivity({ ...none, retries: 1 }, none)).toBe('vocab');
    });

    it('picks grammar when only grammar has work', () => {
        expect(hubPrimaryActivity(none, { ...none, new: 2 })).toBe('grammar');
    });

    it('picks nothing when there is no work anywhere', () => {
        expect(hubPrimaryActivity(none, none)).toBeNull();
    });
});

describe('hubSummary', () => {
    const now = Date.UTC(2026, 3, 19, 12);

    it('counts the reviews due', () => {
        expect(hubSummary(43, [], now)).toBe('43 reviews due');
        expect(hubSummary(1, [], now)).toBe('1 review due');
    });

    it('names the earliest next review once caught up', () => {
        const soon = new Date(now + 135 * 60_000);
        const later = new Date(now + 5 * 3_600_000);
        expect(hubSummary(0, [later, null, soon], now)).toBe('All caught up. Next review in 2 h 15 min.');
        expect(hubSummary(0, [null], now)).toBe('All caught up.');
    });
});
