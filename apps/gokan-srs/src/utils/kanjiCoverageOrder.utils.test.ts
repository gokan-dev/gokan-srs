import { describe, it, expect } from 'vitest';
import { coverageCandidates, kanjiCoverageScore, kanjiCoverageScores, pickKanjiCoverage } from './kanjiCoverageOrder.utils';
import type { CoverageCandidate } from './kanjiCoverageOrder.utils';

/** Candidates in frequency order, ranked by position: [id, kanji]. */
function candidates(...words: [string, string][]): CoverageCandidate[] {
    return words.map(([id, kanji], rank) => ({ id, rank, kanji: [...kanji] }));
}

const uncovered = (kanji: string, needed = 1) => new Map([...kanji].map(k => [k, needed]));

describe('coverageCandidates', () => {
    it('keeps the learnable words not in the queue, in frequency order with their ranks', () => {
        const kanjiOf = new Map([['nichi', ['日']], ['tsuki', ['月']], ['kono', []], ['nihon', ['日', '本']]]);
        const ranked = [...kanjiOf.keys()].map((id, rank) => [id, rank] as const);
        const result = coverageCandidates(ranked, kanjiOf, new Set(['tsuki']), id => id !== 'kono');
        expect(result).toEqual([
            { id: 'nichi', rank: 0, kanji: ['日'] },
            { id: 'nihon', rank: 3, kanji: ['日', '本'] },
        ]);
    });
});

describe('kanjiCoverageScore', () => {
    it('is pure frequency with no kanji credited', () => {
        expect(kanjiCoverageScore(0, 0)).toBeGreaterThan(kanjiCoverageScore(1, 0));
    });

    it('values a credited kanji as a fixed ratio of ranks, at most two of them', () => {
        // ×4 per credited kanji, +200 before the log: rank 1000 credited once ties rank 100 uncredited.
        expect(kanjiCoverageScore(1000, 1)).toBeCloseTo(kanjiCoverageScore(100, 0));
        expect(kanjiCoverageScore(500, 3)).toBe(kanjiCoverageScore(500, 2));
    });
});

describe('kanjiCoverageScores', () => {
    it("gives no bonus for a kanji to a word outside that kanji's top 3 remaining words", () => {
        const words = candidates(['gakusei', '学生'], ['sensei', '先生'], ['jinsei', '人生'], ['seinengappi', '生年月日']);
        const scores = kanjiCoverageScores(words, uncovered('生'));
        expect(scores.get('jinsei')).toBe(kanjiCoverageScore(2, 1));
        expect(scores.get('seinengappi')).toBe(kanjiCoverageScore(3, 0));
    });

    it('counts a kanji written twice in a word once', () => {
        const scores = kanjiCoverageScores(candidates(['jibunjishin', '自分自身']), uncovered('自'));
        expect(scores.get('jibunjishin')).toBe(kanjiCoverageScore(0, 1));
    });
});

describe('pickKanjiCoverage', () => {
    it('offers 自分 before 自分自身, though the compound covers more', () => {
        const words = candidates(['jibun', '自分'], ['jishin', '自身'], ['jibunjishin', '自分自身']);
        expect(pickKanjiCoverage(words, uncovered('自分身'), 2)).toEqual(['jibun', 'jishin']);
    });

    it('prefers a rarer word that covers a kanji over a more frequent one that covers nothing', () => {
        const words = candidates(['nichi', '日'], ['tsuki', '月']);
        expect(pickKanjiCoverage(words, uncovered('月'), 1)).toEqual(['tsuki']);
    });

    it('re-scores after each pick, so a batch does not cover the same kanji twice', () => {
        const words = candidates(['nichi', '日'], ['nihon', '日本'], ['tsuki', '月']);
        // Scored once, 日本 would come second: it is the more frequent word still credited for 日.
        expect(pickKanjiCoverage(words, uncovered('日月'), 2)).toEqual(['nichi', 'tsuki']);
    });

    it('keeps a kanji uncovered until it appears in as many words as it still needs', () => {
        const words = candidates(['nichi', '日'], ['tsuki', '月'], ['nihon', '日本']);
        expect(pickKanjiCoverage(words, uncovered('日', 2), 2)).toEqual(['nichi', 'nihon']);
    });

    it('comes in frequency order with nothing left uncovered', () => {
        const words = candidates(['nichi', '日'], ['nihon', '日本'], ['tsuki', '月']);
        expect(pickKanjiCoverage(words, new Map(), 3)).toEqual(['nichi', 'nihon', 'tsuki']);
    });

    it('stops at the candidates it has', () => {
        expect(pickKanjiCoverage(candidates(['nichi', '日']), uncovered('日'), 3)).toEqual(['nichi']);
    });
});
