import { describe, expect, it } from 'vitest';
import { enSearch } from './en';
import { zhHansSearch } from './zh-hans';

/** Every fixed string of a set of the script's words, its functions' output aside. */
const strings = (value: unknown): string[] => (typeof value === 'string'
    ? [value.trim()]
    : value !== null && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);

describe('zhHansSearch', () => {
    it('writes every word of its own, none of English\'s', () => {
        const english = new Set(strings(enSearch));
        expect(strings(zhHansSearch).filter(text => text !== '' && english.has(text))).toEqual([]);
    });

    it('counts in Chinese, the number grouped as English groups it', () => {
        expect(zhHansSearch.status(0)).toBe('没有结果');
        expect(zhHansSearch.status(3)).toBe('3 个结果');
        expect(zhHansSearch.sectionHeading(zhHansSearch.groups.words, 1234)).toBe('词汇（1,234）');
        expect(zhHansSearch.sectionHeading(zhHansSearch.groups.kanji, 24)).toBe('汉字（24）');
        expect(zhHansSearch.resultsFor('吃')).toBe('“吃”的搜索结果');
    });
});
