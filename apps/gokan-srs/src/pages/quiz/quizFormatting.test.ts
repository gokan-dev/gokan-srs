import { describe, it, expect } from 'vitest';
import type { Sense } from '../../models/vocabulary.model';
import { coarsePosLabel, getCoarsePosLabels } from './quizFormatting';

/** Minimal Sense - getCoarsePosLabels only reads `pos`. */
const sense = (pos: string[]): Sense => ({
    pos,
    misc: { rawTags: [] },
    glosses: [],
    related: { compounds: [] },
});

describe('coarsePosLabel', () => {
    it('maps every verb class to "verb"', () => {
        for (const code of ['v1', 'v5u', 'v5r', 'vk', 'vs-i', 'vt', 'vi', 'vz']) {
            expect(coarsePosLabel(code)).toBe('verb');
        }
    });

    it('maps every adjective class to "adjective"', () => {
        for (const code of ['adj-i', 'adj-ix', 'adj-na', 'adj-no', 'adj-pn']) {
            expect(coarsePosLabel(code)).toBe('adjective');
        }
    });

    it('maps noun and adverb classes', () => {
        expect(coarsePosLabel('n')).toBe('noun');
        expect(coarsePosLabel('n-adv')).toBe('noun');
        expect(coarsePosLabel('adv')).toBe('adverb');
        expect(coarsePosLabel('adv-to')).toBe('adverb');
    });

    it('returns null for codes with no useful plain label', () => {
        expect(coarsePosLabel('unc')).toBeNull();
        expect(coarsePosLabel('on-mim')).toBeNull();
        expect(coarsePosLabel('')).toBeNull();
    });
});

describe('getCoarsePosLabels', () => {
    it('is a single label for a single-class word (強い: all adj-i)', () => {
        expect(getCoarsePosLabels([sense(['adj-i'])])).toEqual(['adjective']);
    });

    it('dedupes a class repeated across senses', () => {
        expect(getCoarsePosLabels([sense(['v5r', 'vt']), sense(['v5r', 'vi'])])).toEqual(['verb']);
    });

    it('collapses a word carrying two classes, verb before noun (suru-noun shape)', () => {
        expect(getCoarsePosLabels([sense(['n', 'vs'])])).toEqual(['verb', 'noun']);
    });

    it('orders 丈夫 (na-adj sense, then noun sense) as adjective before noun', () => {
        expect(getCoarsePosLabels([sense(['adj-na']), sense(['n'])])).toEqual(['adjective', 'noun']);
    });

    it('omits unmapped classes rather than showing jargon', () => {
        expect(getCoarsePosLabels([sense(['n', 'unc'])])).toEqual(['noun']);
    });

    it('is empty when no sense carries a mappable class', () => {
        expect(getCoarsePosLabels([sense(['unc'])])).toEqual([]);
        expect(getCoarsePosLabels([])).toEqual([]);
    });
});
