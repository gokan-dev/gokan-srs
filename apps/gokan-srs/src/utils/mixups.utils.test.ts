import { describe, it, expect } from 'vitest';
import { MIXUP_LIMIT, appendMixups, mergeMixups, mixedUpLabel, mixupCounts, mixupKey, mixupsAsked } from './mixups.utils';
import { mixupRecord } from '../test/fixtures';

describe('mixupKey', () => {
    it('tells records apart by word asked, answer typed, and date', () => {
        const base = mixupRecord();
        expect(mixupKey(base)).toBe(mixupKey({ ...base, cue: 'Her eyes shone.' }));
        expect(mixupKey(base)).not.toBe(mixupKey({ ...base, date: base.date + 1 }));
        expect(mixupKey(base)).not.toBe(mixupKey({ ...base, answer: 'ひかる' }));
    });
});

describe('appendMixups', () => {
    it('adds records oldest first, starting from none', () => {
        expect(appendMixups(undefined, [mixupRecord({ date: 2 }), mixupRecord({ date: 1 })]).map(m => m.date)).toEqual([1, 2]);
    });

    it('keeps the newest MIXUP_LIMIT records, whatever they name', () => {
        const existing = Array.from({ length: MIXUP_LIMIT }, (_, i) => mixupRecord({ date: i, ...(i % 2 ? { typed: undefined } : {}) }));
        const next = appendMixups(existing, [mixupRecord({ date: MIXUP_LIMIT })]);
        expect(next).toHaveLength(MIXUP_LIMIT);
        expect(next[0].date).toBe(1);
        expect(next.at(-1)?.date).toBe(MIXUP_LIMIT);
    });
});

describe('mergeMixups', () => {
    it('is a union, each record once', () => {
        const a = mixupRecord({ date: 1 });
        const b = mixupRecord({ date: 2, answer: 'てらす', typed: undefined, outcome: 'wrong' });
        expect(mergeMixups([a, b], [{ ...a }])).toEqual([a, b]);
        expect(mergeMixups(undefined, [b])).toEqual([b]);
    });

    it('stays absent when neither side has any', () => {
        expect(mergeMixups(undefined, undefined)).toBeUndefined();
    });
});

describe('mixupsAsked (a word page lists its own history)', () => {
    it("keeps the records where the word was asked, newest first, not the ones where it was typed", () => {
        const older = mixupRecord({ asked: 'kagayaku', date: 1 });
        const newer = mixupRecord({ asked: 'kagayaku', answer: 'てらす', typed: undefined, outcome: 'wrong', date: 2 });
        const typedHere = mixupRecord({ asked: 'hikaru', typed: 'kagayaku', date: 3 });
        expect(mixupsAsked([older, typedHere, newer], 'kagayaku')).toEqual([newer, older]);
        expect(mixupsAsked(undefined, 'kagayaku')).toEqual([]);
    });
});

describe('mixupCounts (the Synonyms card says how often)', () => {
    it('counts both directions, and only records naming the other word', () => {
        const records = [
            mixupRecord({ asked: 'kagayaku', typed: 'hikaru', date: 1 }),
            mixupRecord({ asked: 'hikaru', typed: 'kagayaku', date: 2 }),
            mixupRecord({ asked: 'kagayaku', typed: undefined, answer: 'てらす', outcome: 'wrong', date: 3 }),
            mixupRecord({ asked: 'hikaru', typed: 'hoshi', date: 4 }),
        ];
        expect([...mixupCounts(records, 'kagayaku')]).toEqual([['hikaru', 2]]);
    });

    it('reads as words', () => {
        expect(mixedUpLabel(1)).toBe('Mixed up once');
        expect(mixedUpLabel(3)).toBe('Mixed up 3 times');
    });
});
