import { describe, expect, it } from 'vitest';
import type { Sense } from '@gokan/dataset-schema';
import { meaningsOf, summaryGloss, VISIBLE_SENSES } from './senses';

function sense(glosses: string[], pos: string[] = ['n'], rawTags: string[] = []): Sense {
    return { pos, misc: { rawTags, isArchaic: rawTags.includes('arch') }, glosses, related: { compounds: [] } };
}

describe('meaningsOf', () => {
    it('labels the part of speech in plain English, only when it changes', () => {
        const { visible } = meaningsOf([sense(['to eat'], ['v1', 'vt']), sense(['to live on'], ['v1', 'vt']), sense(['meal'], ['n'])]);
        expect(visible.map(v => v.pos)).toEqual(['Ichidan verb, Transitive', undefined, 'Noun']);
    });

    it('shows usage labels after the glosses, leaving "usually kana" to the header', () => {
        const { visible } = meaningsOf([sense(['honourable'], ['suf'], ['hon', 'uk'])]);
        expect(visible[0]).toEqual({ number: 1, pos: 'Suffix', glosses: 'honourable', labels: ['Honorific'] });
    });

    it('shows the first five common senses, the rest behind a disclosure, rare ones last', () => {
        const senses = [
            sense(['archaic one'], ['n'], ['arch']),
            ...Array.from({ length: 7 }, (_, i) => sense([`common ${i + 1}`])),
            sense(['dated one'], ['n'], ['dated']),
        ];
        const { visible, more, rare } = meaningsOf(senses);
        expect(visible).toHaveLength(VISIBLE_SENSES);
        expect(visible.map(v => v.glosses)).toEqual(['common 1', 'common 2', 'common 3', 'common 4', 'common 5']);
        expect(more.map(v => [v.number, v.glosses])).toEqual([[6, 'common 6'], [7, 'common 7']]);
        expect(rare.map(v => [v.number, v.glosses])).toEqual([[8, 'archaic one'], [9, 'dated one']]);
    });

    it('has nothing behind the disclosure when a word has few senses', () => {
        const { visible, more, rare } = meaningsOf([sense(['a']), sense(['b'])]);
        expect([visible.length, more.length, rare.length]).toEqual([2, 0, 0]);
    });
});

describe('summaryGloss', () => {
    it('says each gloss once', () => {
        expect(summaryGloss([sense(['here', 'this place']), sense(['this point', 'here'])])).toBe('here; this place; this point');
    });

    it('stops at four glosses and puts rare senses last', () => {
        expect(summaryGloss([sense(['emperor'], ['n'], ['arch']), sense(['a', 'b']), sense(['c', 'd', 'e'])])).toBe('a; b; c; d');
    });
});
