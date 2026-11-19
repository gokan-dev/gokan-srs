import { describe, expect, it } from 'vitest';
import { moraeOf, pitchAccentKind, pitchContour, pitchGraph, primaryPitchAccent } from './pitchAccent';

const highs = (reading: string, downstep: number) => {
    const c = pitchContour(reading, downstep);
    return [...c.morae.map(m => (m.high ? 'H' : 'L')), c.particleHigh ? 'H' : 'L'].join('');
};

describe('moraeOf', () => {
    it('joins a small ゃゅょ to the mora before it', () => {
        expect(moraeOf('きょう')).toEqual(['きょ', 'う']);
        expect(moraeOf('ティッシュ')).toEqual(['ティ', 'ッ', 'シュ']);
    });

    it('counts っ, ん and ー as morae', () => {
        expect(moraeOf('がっこう')).toEqual(['が', 'っ', 'こ', 'う']);
        expect(moraeOf('せんせい')).toHaveLength(4);
        expect(moraeOf('コーヒー')).toEqual(['コ', 'ー', 'ヒ', 'ー']);
    });
});

describe('pitchContour', () => {
    it('tells the three はし apart, by the particle for heiban and odaka', () => {
        expect(highs('はし', 1)).toBe('HLL'); // 箸
        expect(highs('はし', 2)).toBe('LHL'); // 橋
        expect(highs('はし', 0)).toBe('LHH'); // 端
    });

    it('drops inside the word for nakadaka', () => {
        expect(highs('せんせい', 3)).toBe('LHHLL');
        expect(highs('ふしぎ', 0)).toBe('LHHH');
    });
});

describe('pitchAccentKind', () => {
    it('names each pattern', () => {
        expect(pitchAccentKind('はし', 0)).toBe('heiban');
        expect(pitchAccentKind('はし', 1)).toBe('atamadaka');
        expect(pitchAccentKind('せんせい', 3)).toBe('nakadaka');
        expect(pitchAccentKind('はし', 2)).toBe('odaka');
    });
});

describe('pitchGraph', () => {
    it('puts each dot over the middle of its mora, 1em a kana, and the particle one em past the reading', () => {
        const g = pitchGraph('きょう', 1);
        // きょ spans 0 to 2em, う 2 to 3em, the particle 3 to 4em.
        expect(g.points.map(p => p.x)).toEqual([1, 2.5, 3.5]);
        expect(g.points.map(p => p.particle ?? false)).toEqual([false, false, true]);
        expect(g.points.map(p => p.high)).toEqual([true, false, false]);
        expect(g.width).toBe(4);
    });

    it('joins the dots, stopping the last line at the particle dot edge', () => {
        const g = pitchGraph('はし', 0);
        expect(g.segments).toHaveLength(2);
        const last = g.segments[1];
        const particle = g.points[2];
        expect(last?.x2).toBeCloseTo((particle?.x ?? 0) - g.radius, 2);
        expect(last?.y2).toBe(particle?.y);
    });
});

describe('primaryPitchAccent', () => {
    it('is the entry for the primary reading, when there is one', () => {
        const entry = { reading: 'じょうず', downsteps: [3], source: 'wiktionary' as const };
        const reading = { primary: 'じょうず', alternatives: ['うわて'] };
        expect(primaryPitchAccent({ reading, pitchAccent: [{ ...entry, reading: 'うわて' }, entry] })).toBe(entry);
        expect(primaryPitchAccent({ reading, pitchAccent: [{ ...entry, reading: 'うわて' }] })).toBeUndefined();
        expect(primaryPitchAccent({ reading })).toBeUndefined();
    });
});
