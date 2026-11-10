import { describe, expect, it } from 'vitest';
import { vocabulary, wordText } from '../../test/fixtures';
import { en } from './en';
import { catalogStrings } from './index';
import { zhHans } from './zh-hans';

describe('zhHans', () => {
    it('writes every fixed string of its own, none of English\'s', () => {
        const english = new Set(catalogStrings(en));
        // Names stay as they are in either language: the dataset, the app, a source.
        const shared = catalogStrings(zhHans).filter(text => english.has(text));
        expect(shared).toEqual(['Tatoeba', 'Gokan']);
    });

    it('counts in Chinese, the number grouped as English groups it', () => {
        expect(zhHans.count(35872, 'word')).toBe('35,872 个词');
        expect(zhHans.count(9, 'stroke')).toBe('9 画');
    });

    it('titles a word page with its meaning in Chinese, else its English one', () => {
        expect(zhHans.meta.vocab(vocabulary({ jlptLevel: 4 }), wordText()).title).toBe('思う（おもう）的中文意思：想、认为 | JLPT N4 - Gokan 日语词典');
        expect(zhHans.meta.vocab(vocabulary()).description).toContain('to think');
    });

    it('writes no line break into its text, which would read as a space between two characters', () => {
        // English's footer keeps one, only so its pages stay byte-identical: a copy of it here broke a line after 。.
        const links = { dataset: '/d/', srs: '/s/', vocab: '/v/', kanji: '/k/', grammar: '/g/', home: '/' };
        const linked = [zhHans.chrome.footer(links), zhHans.home.aboutText(links), zhHans.error.browse(links)]
            .flat().map(part => (typeof part === 'string' ? part : part.text));
        const broken = [...catalogStrings(zhHans), ...linked].filter(text => text.includes('\n'));
        expect(broken).toEqual([]);
    });

    it('marks every link to an English page the same way', () => {
        const links = { dataset: '/d/', srs: '/s/', vocab: '/v/', kanji: '/k/', grammar: '/g/', home: '/' };
        const marked = (parts: ReturnType<typeof zhHans.chrome.footer>) => parts.filter(part => typeof part === 'string' && part.startsWith(`（${zhHans.chrome.inEnglish}）`)).length;
        expect(marked(zhHans.chrome.footer(links))).toBe(2);
        expect(marked(zhHans.home.aboutText(links))).toBe(2);
        expect(zhHans.home.tiles.kanji(2136).meta).toBe(`2,136 个汉字 · ${zhHans.chrome.inEnglish}页面`);
    });

    it('says which links lead to an English page', () => {
        const parts = zhHans.error.browse({ vocab: '/v/', kanji: '/k/', grammar: '/g/', home: '/' });
        expect(parts).toContainEqual({ text: '汉字（英文）', href: '/k/' });
    });
});
