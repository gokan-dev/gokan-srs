import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMinutes, formatShortDate, formatTimeUntil, formatWeekday, minutesUntil } from './time.utils';

const now = new Date('2026-06-10T12:00:00Z').getTime();
const inMs = (ms: number) => new Date(now + ms);

describe('minutesUntil', () => {
    it('rounds up and never reports less than one minute', () => {
        expect(minutesUntil(inMs(90_000), now)).toBe(2);
        expect(minutesUntil(inMs(1_000), now)).toBe(1);
        expect(minutesUntil(inMs(-60_000), now)).toBe(1);
    });
});

describe('formatMinutes', () => {
    it('pluralizes', () => {
        expect(formatMinutes(1)).toBe('1 minute');
        expect(formatMinutes(5)).toBe('5 minutes');
    });
});

describe('formatTimeUntil', () => {
    it('covers each unit, and the past', () => {
        expect(formatTimeUntil(null, now)).toBe('-');
        expect(formatTimeUntil(inMs(-1), now)).toBe('Now');
        expect(formatTimeUntil(inMs(5 * 60_000), now)).toBe('in 5 min');
        expect(formatTimeUntil(inMs(3 * 3_600_000), now)).toBe('in 3 h');
        expect(formatTimeUntil(inMs(2 * 86_400_000), now)).toBe('in 2 d');
    });

    it('shows the date itself a week or more out', () => {
        const date = inMs(10 * 86_400_000);
        expect(formatTimeUntil(date, now)).toBe(formatDate(date));
    });
});

describe('formatDate', () => {
    it('always formats in en-US, regardless of the host locale', () => {
        expect(formatDate(new Date('2026-04-19T12:00:00Z'))).toBe('Apr 19, 2026');
    });
});

describe('formatShortDate', () => {
    it('omits the year', () => {
        expect(formatShortDate(new Date('2026-10-11T12:00:00Z'))).toBe('Oct 11');
    });
});

describe('formatDateTime', () => {
    it('combines the date and the time', () => {
        expect(formatDateTime(new Date('2026-04-19T10:59:00Z'))).toBe('Apr 19, 2026, 10:59 AM');
    });
});

describe('formatWeekday', () => {
    it('gives the three-letter weekday', () => {
        expect(formatWeekday(new Date('2026-04-20T00:00:00Z'))).toBe('Mon');
    });
});
