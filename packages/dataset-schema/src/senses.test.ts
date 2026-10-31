import { describe, expect, it } from 'vitest';
import { isRareSense, summaryGloss } from './senses';
import type { Sense } from './vocabulary';

function sense(glosses: string[], rawTags: string[] = []): Sense {
    return { pos: ['n'], misc: { rawTags, isArchaic: rawTags.includes('arch') }, glosses, related: { compounds: [] } };
}

describe('isRareSense', () => {
    it('reads the archaic and rare flags and the rare tags', () => {
        expect(isRareSense(sense(['a'], ['arch']))).toBe(true);
        expect(isRareSense({ misc: { rawTags: [], isRare: true } })).toBe(true);
        expect(isRareSense(sense(['a'], ['dated']))).toBe(true);
        expect(isRareSense(sense(['a'], ['hon']))).toBe(false);
    });
});

describe('summaryGloss', () => {
    it('says each gloss once', () => {
        expect(summaryGloss([sense(['here', 'this place']), sense(['this point', 'here'])])).toBe('here; this place; this point');
    });

    it('stops at four glosses and puts rare senses last', () => {
        expect(summaryGloss([sense(['emperor'], ['arch']), sense(['a', 'b']), sense(['c', 'd', 'e'])])).toBe('a; b; c; d');
    });

    it('falls back to the rare senses when every sense is rare', () => {
        expect(summaryGloss([sense(['lady'], ['arch'])])).toBe('lady');
    });
});
