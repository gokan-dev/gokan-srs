import { describe, it, expect } from 'vitest';
import type { Sentence } from '@gokan/dataset-schema';
import { grammarClozeSentence, grammarExampleToSentence, productionClozeSentence, splitAtBlanks } from './clozeSentence.utils';
import type { ClozePart, ClozeSentence } from './clozeSentence.utils';
import { grammarExample } from '../test/fixtures';

const sentence = (original: string, matches: Sentence['matches'] = {}): Sentence =>
    ({ id: 's1', original, en: [{ id: 'e1', text: '' }], vocabIds: Object.keys(matches), matches });

/** The text of every part, in order: must always reproduce the original sentence. */
const rejoin = (parts: ClozePart[]) => parts.map(p => (p.kind === 'text' ? p.sentence.original : p.surface)).join('');
const texts = (parts: ClozePart[]) => parts.flatMap(p => (p.kind === 'text' ? [p.sentence] : []));

describe('splitAtBlanks', () => {
    // Real dataset shape: blanking 欲 (start 25, length 1) among 貧しい / 持っていない / 人 x3.
    const long = sentence('貧しい人とはほんのわずかしか持っていない人ではなく欲のありすぎる人である。', {
        '1490740': [{ start: 0, length: 3, reading: 'まずしい' }],
        '1315720': [{ start: 14, length: 6, reading: 'もっていない' }],
        '1547320': [{ start: 25, length: 1, reading: 'よく' }],
        '1580640': [{ start: 3, length: 1, reading: 'ひと' }, { start: 20, length: 1, reading: 'ひと' }, { start: 32, length: 1, reading: 'ひと' }],
    });
    const parts = splitAtBlanks({ sentence: long, blanks: [{ start: 25, length: 1, reading: 'よく' }] });
    const [before, after] = texts(parts);

    it('rejoins into the original sentence, the blank carrying its surface and reading', () => {
        expect(rejoin(parts)).toBe(long.original);
        expect(parts[1]).toEqual({ kind: 'blank', index: 0, surface: '欲', reading: 'よく' });
    });

    it('drops the blanked word from the text, keeping the other matches on their side', () => {
        expect(before.matches?.['1547320']).toBeUndefined();
        expect(after.matches?.['1547320']).toBeUndefined();
        expect(before.matches?.['1580640']).toEqual([{ start: 3, length: 1, reading: 'ひと' }, { start: 20, length: 1, reading: 'ひと' }]);
    });

    it('rebases the offsets of a later fragment to that fragment', () => {
        expect(after.matches?.['1580640']).toEqual([{ start: 6, length: 1, reading: 'ひと' }]);
        expect(after.original[6]).toBe('人');
    });

    it('drops a match that straddles a blank boundary', () => {
        const straddled = splitAtBlanks({ sentence: sentence('abcde', { v1: [{ start: 1, length: 3 }] }), blanks: [{ start: 2, length: 1 }] });
        expect(texts(straddled).every(s => !s.matches?.['v1'])).toBe(true);
    });

    it('handles several blanks, and blanks at either end, without empty fragments', () => {
        const several: ClozeSentence = { sentence: sentence('必ず来る。'), blanks: [{ start: 0, length: 2 }, { start: 2, length: 1 }] };
        const split = splitAtBlanks(several);
        expect(split.map(p => p.kind)).toEqual(['blank', 'blank', 'text']);
        expect(split.filter(p => p.kind === 'blank').map(p => p.kind === 'blank' && p.index)).toEqual([0, 1]);
        expect(rejoin(split)).toBe('必ず来る。');
    });
});

describe('productionClozeSentence', () => {
    it('makes the production cloze one blank, carrying its reading', () => {
        const s = sentence('野菜を食べたら？');
        expect(productionClozeSentence({ sentence: s, blankStart: 3, blankLength: 4, blankReading: 'たべたら' }))
            .toEqual({ sentence: s, blanks: [{ start: 3, length: 4, reading: 'たべたら' }] });
    });
});

describe('grammar examples as sentences', () => {
    const example = grammarExample({
        en: 'Why not eat vegetables?',
        words: [
            { surface: '野菜', vocabId: 'v-yasai', reading: 'やさい' },
            { surface: 'を', vocabId: null },
            { surface: '食べ', vocabId: 'v-taberu', reading: 'たべる', baseForm: '食べる' },
            { surface: 'たら', vocabId: null },
            { surface: '？', vocabId: null },
        ],
    });

    it('joins the words and links every vocab word, without the lemma reading of a conjugated one', () => {
        const s = grammarExampleToSentence(example, 'g1');
        expect(s.original).toBe('野菜を食べたら？');
        expect(s.en[0].text).toBe('Why not eat vegetables?');
        expect(s.matches).toEqual({ 'v-yasai': [{ start: 0, length: 2, reading: 'やさい' }], 'v-taberu': [{ start: 3, length: 2 }] });
    });

    it('places one blank per span, a marker run being a single blank', () => {
        const cloze = grammarClozeSentence(example, [[0], [2, 3]], 'g1');
        expect(cloze.blanks).toEqual([{ start: 0, length: 2, reading: 'やさい' }, { start: 3, length: 4 }]);
        expect(rejoin(splitAtBlanks(cloze))).toBe('野菜を食べたら？');
    });
});
