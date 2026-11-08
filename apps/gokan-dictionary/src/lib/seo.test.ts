import { describe, it, expect } from 'vitest';
import { quotedGlosses, searchablePattern, sentenceCase, truncate } from './seo';

describe('truncate', () => {
    it('keeps a value that fits, and cuts a longer one at a word boundary with an ellipsis', () => {
        expect(truncate('short', 10)).toBe('short');
        expect(truncate('to think, to consider', 10)).toBe('to think,…');
    });
});

describe('searchablePattern', () => {
    it.each([
        ['～を問わず', 'を問わず'],
        ['Noun を余儀なくされる', 'を余儀なくされる'],
        ['Noun から Noun に 至る まで', 'からに至るまで'],
        ['Noun1 も Noun1 なら、Noun2 も Noun2 だ', 'もなら、もだ'],
        ['い-Adjective て', 'て'],
        ['Verb-te kureru', 'te kureru'],
        ['〜ga Verb rareru', 'ga rareru'],
        ['A は B より～', 'A は B より'],
    ])('%s -> %s', (pattern, expected) => {
        expect(searchablePattern(pattern)).toBe(expected);
    });

    it('returns an empty string for a pattern made only of placeholders', () => {
        expect(searchablePattern('Verb')).toBe('');
    });
});

describe('sentenceCase', () => {
    it.each([
        ['causative (させる)', 'Causative (させる)'],
        ['て-form', 'て-form'],
        ['na-adjective adverbial (に)', 'na-adjective adverbial (に)'],
    ])('%s -> %s', (text, expected) => {
        expect(sentenceCase(text)).toBe(expected);
    });
});

describe('quotedGlosses', () => {
    it('joins at most two quoted equivalents', () => {
        expect(quotedGlosses("'not always', 'not necessarily', 'hardly'")).toBe('not always, not necessarily');
    });

    it('does not end a quote at an apostrophe inside a word', () => {
        expect(quotedGlosses("Emphasis; 'isn't it?', 'right?'.")).toBe("isn't it?, right?");
    });

    it('returns undefined when nothing is quoted', () => {
        expect(quotedGlosses('Expresses a desire.')).toBeUndefined();
    });
});
