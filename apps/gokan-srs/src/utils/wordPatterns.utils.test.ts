import { describe, expect, it } from "vitest";
import { sentence, vocabulary } from "../test/fixtures";
import { patternText, sentencesWithPattern } from "./wordPatterns.utils";

describe('sentencesWithPattern', () => {
    const sentences = [
        sentence({ id: 's1', matches: { w: [{ start: 0, length: 3, pattern: 0 }] } }),
        sentence({ id: 's2', matches: { w: [{ start: 0, length: 3 }, { start: 5, length: 3, pattern: 1 }] } }),
        sentence({ id: 's3', matches: { other: [{ start: 0, length: 3, pattern: 1 }] } }),
        sentence({ id: 's4' }),
    ];

    it("keeps the sentences where an occurrence of the word names the pattern, not another word's", () => {
        expect(sentencesWithPattern('w', sentences, 1).map(s => s.id)).toEqual(['s2']);
        expect(sentencesWithPattern('w', sentences, 0).map(s => s.id)).toEqual(['s1']);
        expect(sentencesWithPattern('w', sentences, 2)).toEqual([]);
    });
});

describe('patternText', () => {
    const vocab = vocabulary({ patterns: [{ text: '不思議な〜', sentences: 50 }, { text: '不思議に思う', sentences: 10 }] });

    it("names the word's pattern, and nothing for no filter or one the word lacks", () => {
        expect(patternText(vocab, 1)).toBe('不思議に思う');
        expect(patternText(vocab, null)).toBeNull();
        expect(patternText(vocab, 5)).toBeNull();
        expect(patternText(vocabulary(), 0)).toBeNull();
    });
});
