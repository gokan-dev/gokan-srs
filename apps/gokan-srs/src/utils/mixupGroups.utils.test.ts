import { describe, it, expect } from 'vitest';
import {
    groupsWithWord, mixupGroups, mixupPairs, mixupWeight, mixupWordIds, otherWord, pairsWithWord, resolveAnswers,
} from './mixupGroups.utils';
import type { PairRelation } from './mixupGroups.utils';
import { mixupRecord, searchIndexEntry } from '../test/fixtures';

const NOW = Date.UTC(2026, 9, 18);
const DAY = 24 * 60 * 60 * 1000;

// The issue's shine and gradually examples, with the words named by headword for readability.
const SHARED: Record<string, PairRelation> = {
    '輝く 光る': { tier: 'interchangeable', curated: false, shared: ['glitter', 'shine'] },
    '輝く 差す': { tier: 'confusable', curated: false, shared: ['shine'] },
    '光る 差す': { tier: 'confusable', curated: false, shared: ['shine'] },
    '次第に 徐々に': { tier: 'interchangeable', curated: false, shared: ['gradually'] },
    '次第に 行く': { tier: 'confusable', curated: false, shared: ['gradually'] },
    '行く いらっしゃる': { tier: 'interchangeable', curated: false, shared: ['go'] },
};
const relation = (a: string, b: string) => SHARED[`${a} ${b}`] ?? SHARED[`${b} ${a}`] ?? null;
const typed = (asked: string, word: string, daysAgo = 0) => mixupRecord({ asked, typed: word, tier: undefined, shared: undefined, date: NOW - daysAgo * DAY });

describe('mixupWeight', () => {
    it('halves a mix-up a month on, and counts one accepted in context half', () => {
        expect(mixupWeight({ date: NOW }, NOW)).toBe(1);
        expect(mixupWeight({ date: NOW - 30 * DAY }, NOW)).toBeCloseTo(0.5, 6);
        expect(mixupWeight({ date: NOW, meaning: 'shine' }, NOW)).toBe(0.5);
    });
});

describe('mixupPairs', () => {
    it('counts each pair once whichever word was asked, with both directions', () => {
        const [pair] = mixupPairs([typed('輝く', '光る'), typed('輝く', '光る'), typed('光る', '輝く')], relation, NOW);
        expect(pair.words).toEqual(['光る', '輝く'].sort());
        expect(pair.count).toBe(3);
        expect(pair.directions).toEqual([{ asked: '輝く', typed: '光る', count: 2 }, { asked: '光る', typed: '輝く', count: 1 }]);
        expect(pair).toMatchObject({ tier: 'interchangeable', shared: ['glitter', 'shine'] });
    });

    it('takes the tier grading reads today over the record\'s copy, and the copy when the word did not load', () => {
        const stale = mixupRecord({ asked: '輝く', typed: '光る', tier: 'confusable', shared: ['shine'] });
        expect(mixupPairs([stale], relation, NOW)[0].tier).toBe('interchangeable');
        expect(mixupPairs([stale], () => null, NOW)[0]).toMatchObject({ tier: 'confusable', shared: ['shine'] });
    });

    it('reads a pair the dataset does not have as not a synonym', () => {
        expect(mixupPairs([typed('輝く', '照らす')], relation, NOW)[0]).toMatchObject({ tier: 'unrelated', shared: [] });
    });

    it('skips a raw answer not resolved yet', () => {
        expect(mixupPairs([mixupRecord({ typed: undefined, answer: 'てらす' })], relation, NOW)).toEqual([]);
    });
});

describe('mixupGroups', () => {
    it('joins pairs sharing a word and a meaning (the shine group)', () => {
        const groups = mixupGroups(mixupPairs([typed('輝く', '光る'), typed('光る', '差す'), typed('輝く', '差す')], relation, NOW));
        expect(groups).toHaveLength(1);
        expect([...groups[0].words].sort()).toEqual(['光る', '差す', '輝く'].sort());
        expect(groups[0].meanings).toEqual(['shine', 'glitter']);
    });

    it('keeps pairs apart that share a word in different meanings, the word in both groups', () => {
        const groups = mixupGroups(mixupPairs([typed('次第に', '徐々に'), typed('次第に', '行く'), typed('行く', 'いらっしゃる')], relation, NOW));
        expect(groups.map(g => [...g.words].sort())).toEqual(expect.arrayContaining([
            ['徐々に', '次第に', '行く'].sort(),
            ['いらっしゃる', '行く'].sort(),
        ]));
        expect(groupsWithWord(groups, '行く')).toHaveLength(2);
        expect(groupsWithWord(groups, '行く').map(g => g.meanings)).toEqual(expect.arrayContaining([['gradually'], ['go']]));
    });

    it('puts a pair with no shared meaning in its asked word\'s group, never bridging two', () => {
        const groups = mixupGroups(mixupPairs([typed('輝く', '光る'), typed('輝く', '照らす'), typed('行く', 'いらっしゃる')], relation, NOW));
        const shine = groupsWithWord(groups, '輝く');
        expect(shine).toHaveLength(1);
        expect(shine[0].words).toContain('照らす');
        expect(shine[0].meanings).toEqual(['glitter', 'shine']);
    });

    it('gives the asked word\'s unrelated pairs their own group when it has no other, labelled by nothing', () => {
        const [group] = mixupGroups(mixupPairs([typed('輝く', '照らす')], relation, NOW));
        expect(group).toMatchObject({ asked: '輝く', meanings: [] });
    });

    it('ranks recent mix-ups first, so a group you stopped confusing sinks', () => {
        const groups = mixupGroups(mixupPairs([
            typed('輝く', '光る', 120), typed('輝く', '光る', 120), typed('輝く', '光る', 120),
            typed('行く', 'いらっしゃる', 1),
        ], relation, NOW));
        expect(groups[0].words).toContain('行く');
    });
});

describe('a word\'s pairs', () => {
    it('lists the pairs a word is in, the most mixed up first, and names the other word', () => {
        const pairs = mixupPairs([typed('輝く', '光る'), typed('輝く', '差す'), typed('輝く', '差す')], relation, NOW);
        const mine = pairsWithWord(pairs, '輝く');
        expect(mine.map(p => otherWord(p, '輝く'))).toEqual(['差す', '光る']);
    });

    it('names every word to load, a raw answer\'s asked word included', () => {
        expect(mixupWordIds([typed('輝く', '光る'), mixupRecord({ asked: '差す', typed: undefined, answer: 'x' })])).toEqual(['輝く', '光る', '差す']);
    });
});

describe('resolveAnswers', () => {
    const index = [
        searchIndexEntry({ id: 'terasu', w: '照らす', r: 'てらす' }),
        searchIndexEntry({ id: 'terasu-2', w: '衒らす', r: 'てらす' }),
        searchIndexEntry({ id: 'kagayaku', w: '輝く', r: 'かがやく' }),
    ];
    const raw = (answer: string) => mixupRecord({ asked: 'kagayaku', typed: undefined, tier: undefined, shared: undefined, answer });

    it('resolves a reading, romaji or katakana included, to the words being studied', () => {
        const learning = new Set(['terasu', 'kagayaku']);
        for (const answer of ['てらす', 'terasu', 'テラス', '照らす']) {
            expect(resolveAnswers([raw(answer)], index, learning).map(r => r.typed)).toEqual(['terasu']);
        }
    });

    it('drops an answer that is no word being studied, or the word asked itself', () => {
        expect(resolveAnswers([raw('ねこ')], index, new Set(['terasu']))).toEqual([]);
        expect(resolveAnswers([raw('かがやく')], index, new Set(['kagayaku']))).toEqual([]);
    });

    it('leaves an identified record as it is', () => {
        const record = typed('輝く', '光る');
        expect(resolveAnswers([record], index, new Set())).toEqual([record]);
    });
});
