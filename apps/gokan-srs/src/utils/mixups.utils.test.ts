import { describe, it, expect } from 'vitest';
import { MIXUP_LIMIT, appendMixups, mergeMixups, mixupKey } from './mixups.utils';
import { mixupRecord } from '../test/fixtures';

describe('mixupKey', () => {
    it('tells records apart by word asked, word or text typed, and date', () => {
        const base = mixupRecord();
        expect(mixupKey(base)).toBe(mixupKey({ ...base, tier: 'confusable' }));
        expect(mixupKey(base)).not.toBe(mixupKey({ ...base, date: base.date + 1 }));
        expect(mixupKey(base)).not.toBe(mixupKey({ ...base, typed: undefined, answer: '1272820' + 'x' }));
    });
});

describe('appendMixups', () => {
    it('adds records oldest first, starting from none', () => {
        expect(appendMixups(undefined, [mixupRecord({ date: 2 }), mixupRecord({ date: 1 })]).map(m => m.date)).toEqual([1, 2]);
    });

    it('keeps the newest MIXUP_LIMIT records', () => {
        const existing = Array.from({ length: MIXUP_LIMIT }, (_, i) => mixupRecord({ date: i }));
        const next = appendMixups(existing, [mixupRecord({ date: MIXUP_LIMIT })]);
        expect(next).toHaveLength(MIXUP_LIMIT);
        expect(next[0].date).toBe(1);
        expect(next.at(-1)?.date).toBe(MIXUP_LIMIT);
    });


    it('drops the oldest raw answers first, so typos never push out identified pairs', () => {
        const raw = Array.from({ length: MIXUP_LIMIT }, (_, i) => mixupRecord({ typed: undefined, answer: 'x', date: 10 + i }));
        const next = appendMixups([mixupRecord({ date: 1 }), ...raw], [mixupRecord({ date: 5000 })]);
        expect(next).toHaveLength(MIXUP_LIMIT);
        expect(next.filter(r => r.typed !== undefined).map(r => r.date)).toEqual([1, 5000]);
    });
});

describe('mergeMixups', () => {
    it('is a union, each record once', () => {
        const a = mixupRecord({ date: 1 });
        const b = mixupRecord({ date: 2, typed: '1291330' });
        expect(mergeMixups([a, b], [{ ...a }])).toEqual([a, b]);
        expect(mergeMixups(undefined, [b])).toEqual([b]);
    });

    it('stays absent when neither side has any', () => {
        expect(mergeMixups(undefined, undefined)).toBeUndefined();
    });
});
