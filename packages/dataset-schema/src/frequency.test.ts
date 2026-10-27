import { describe, expect, it } from 'vitest';
import { frequencyBand, UNRANKED } from './frequency';

describe('frequencyBand', () => {
    it('names the band at each edge', () => {
        expect(frequencyBand(1).name).toBe('Very common');
        expect(frequencyBand(1_000).name).toBe('Very common');
        expect(frequencyBand(1_001).name).toBe('Common');
        expect(frequencyBand(5_000).name).toBe('Common');
        expect(frequencyBand(5_001).name).toBe('Less common');
        expect(frequencyBand(15_000).name).toBe('Less common');
        expect(frequencyBand(15_001).name).toBe('Rare');
    });

    it('fills one bar fewer per band', () => {
        expect([264, 3_000, 12_000, 40_000].map(r => frequencyBand(r).bars)).toEqual([4, 3, 2, 1]);
    });

    it('rounds the rank up to a top list', () => {
        expect(frequencyBand(100).reference).toBe('Top 100 words');
        expect(frequencyBand(264).reference).toBe('Top 300 words');
        expect(frequencyBand(301).reference).toBe('Top 500 words');
        expect(frequencyBand(7_500).reference).toBe('Top 10,000 words');
        expect(frequencyBand(50_000).reference).toBe('Top 50,000 words');
        expect(frequencyBand(50_001).reference).toBe('Beyond the top 50,000');
    });

    it('reads an unranked word as Rare, outside the list', () => {
        for (const rank of [UNRANKED, undefined, null, 0]) {
            expect(frequencyBand(rank)).toEqual({ name: 'Rare', bars: 1, reference: 'Not in the frequency list' });
        }
    });
});
