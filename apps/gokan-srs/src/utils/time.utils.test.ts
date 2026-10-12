import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDurationUntil, formatMinutes, formatShortDate, formatTimeUntil, formatWeekday, minutesUntil, nextReviewPhrase } from './time.utils';

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

// These two format in the viewer's timezone, so their inputs are local dates: a UTC instant
// shows a different hour (or, near midnight, a different day) on a machine outside UTC.
describe('formatDateTime', () => {
    it('combines the date and the time', () => {
        expect(formatDateTime(new Date(2026, 3, 19, 10, 59))).toBe('Apr 19, 2026, 10:59 AM');
    });
});

describe('formatWeekday', () => {
    it('gives the three-letter weekday', () => {
        expect(formatWeekday(new Date(2026, 3, 20))).toBe('Mon');
    });
});

describe('formatDurationUntil', () => {
    const now = Date.UTC(2026, 3, 19, 12, 0);
    const later = (minutes: number) => new Date(now + minutes * 60_000);

    it('counts minutes, then hours and minutes, then days', () => {
        expect(formatDurationUntil(later(12), now)).toBe('12 min');
        expect(formatDurationUntil(later(135), now)).toBe('2 h 15 min');
        expect(formatDurationUntil(later(180), now)).toBe('3 h');
        expect(formatDurationUntil(later(24 * 60), now)).toBe('1 day');
        expect(formatDurationUntil(later(3 * 24 * 60 + 30), now)).toBe('3 days');
    });
});

describe('nextReviewPhrase', () => {
    const now = Date.UTC(2026, 3, 19, 12, 0);

    it('says Due now for a past or present date', () => {
        expect(nextReviewPhrase(new Date(now - 1000), now)).toBe('Due now');
        expect(nextReviewPhrase(new Date(now), now)).toBe('Due now');
    });

    it('says how long until a near review, and the date of a far one', () => {
        expect(nextReviewPhrase(new Date(now + 3 * 24 * 3_600_000), now)).toBe('Next review in 3 days');
        expect(nextReviewPhrase(new Date(Date.UTC(2026, 9, 1, 12)), now)).toBe('Next review on Oct 1, 2026');
    });
});
