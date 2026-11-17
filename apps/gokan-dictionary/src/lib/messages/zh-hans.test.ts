import { describe, expect, it } from 'vitest';
import { kanjiOrder } from '@gokan/dataset-schema';
import { panelCopyPerOrder, vocabulary, wordText } from '../../test/fixtures';
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
        const links = { dataset: '/d/', srs: { href: '/s/', placement: 'footer' as const }, vocab: '/v/', kanji: '/k/', grammar: '/g/', home: '/' };
        const linked = [zhHans.chrome.footer(links), zhHans.home.aboutText(links), zhHans.error.browse(links)]
            .flat().map(part => (typeof part === 'string' ? part : part.text));
        const broken = [...catalogStrings(zhHans), ...linked].filter(text => text.includes('\n'));
        expect(broken).toEqual([]);
    });

    it('marks every link to an English page the same way', () => {
        const links = { dataset: '/d/', srs: { href: '/s/', placement: 'footer' as const }, vocab: '/v/', kanji: '/k/', grammar: '/g/', home: '/' };
        const marked = (parts: ReturnType<typeof zhHans.chrome.footer>) => parts.filter(part => typeof part === 'string' && part.startsWith(`（${zhHans.chrome.inEnglish}）`)).length;
        expect(marked(zhHans.chrome.footer(links))).toBe(2);
        expect(marked(zhHans.home.aboutText(links))).toBe(2);
        expect(zhHans.home.tiles.kanji(2136).meta).toBe(`2,136 个汉字 · ${zhHans.chrome.inEnglish}页面`);
    });

    it('names every English-only section the home lede points at, the learning orders too', () => {
        const englishOnly = zhHans.home.lede.split('。').find(sentence => sentence.includes(zhHans.chrome.inEnglish)) ?? '';
        for (const section of ['汉字', '语法', '学习顺序']) expect(englishOnly).toContain(section);
    });

    it('says which links lead to an English page', () => {
        const parts = zhHans.error.browse({ vocab: '/v/', kanji: '/k/', grammar: '/g/', home: '/' });
        expect(parts).toContainEqual({ text: '汉字（英文）', href: '/k/' });
    });
});

describe('zhHans appPanel', () => {
    it('marks an order\'s English name and the word, and says the app is in English', () => {
        const copy = zhHans.appPanel.word('学生', { order: kanjiOrder('henshall'), step: 40 });
        expect(copy.text).toContainEqual({ text: 'Henshall', lang: 'en' });
        expect(copy.text).toContainEqual({ text: '学生', lang: 'ja' });
        // A step's action fits one line at 320px, so the sentence says the app is in English, after "Gokan".
        expect(copy.action).toBe('从第 40 步之后开始');
        expect(copy.text.at(-1)).toContain(`Gokan（${zhHans.chrome.inEnglish}页面）`);
    });

    it('marks Maniette\'s title as French', () => {
        expect(zhHans.appPanel.order(kanjiOrder('maniette')).text).toContainEqual({ text: 'Les Kanjis dans la tête', lang: 'fr' });
    });

    it('names a range\'s last step and leaves its word count to the page\'s intro', () => {
        const copy = zhHans.appPanel.range({ order: kanjiOrder('rtkLegacy'), step: 400 });
        expect(copy.text.at(-1)).not.toMatch(/\d+ 个词/);
        expect(copy.text).toContainEqual({ text: 'RTK 1st to 5th editions', lang: 'en' });
        expect(copy.text.at(-1)).toContain('第 400 步');
        expect(copy.action.startsWith('从第 400 步之后开始')).toBe(true);
    });
});

// Every order's panel copy, written out once (as in en.test.ts) so a reviewer reads all eleven.
describe('zhHans appPanel copy per order', () => {
    it('reads well for every order', () => {
        expect(panelCopyPerOrder(zhHans)).toMatchInlineSnapshot(`
          "kklc:
            学完 {en:KKLC} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:KKLC} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:KKLC} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:KKLC} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          rtk:
            学完 {en:RTK} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:RTK} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:RTK} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:RTK} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          jlpt:
            学完 {en:JLPT kanji order} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:JLPT kanji order} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:JLPT kanji order} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:JLPT kanji order} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          frequency:
            学完 {en:Kanji frequency order} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:Kanji frequency order} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:Kanji frequency order} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:Kanji frequency order} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          kanjiKana:
            学完 {en:Kanji & Kana} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:Kanji & Kana} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:Kanji & Kana} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:Kanji & Kana} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          kanjiInContext:
            学完 {en:Kanji in Context} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:Kanji in Context} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:Kanji in Context} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:Kanji in Context} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          rtkLegacy:
            学完 {en:RTK 1st to 5th editions} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:RTK 1st to 5th editions} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:RTK 1st to 5th editions} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:RTK 1st to 5th editions} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          henshall:
            学完 {en:Henshall} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:Henshall} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:Henshall} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:Henshall} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          kanjiFlashcards:
            学完 {en:White Rabbit kanji cards} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:White Rabbit kanji cards} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:White Rabbit kanji cards} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:White Rabbit kanji cards} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          tuttleCards:
            学完 {en:Tuttle kanji cards} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {en:Tuttle kanji cards} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {en:Tuttle kanji cards} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {en:Tuttle kanji cards} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]
          maniette:
            学完 {fr:Les Kanjis dans la tête} 的第 1234 步，就能读{ja:学生}。Gokan（英文页面）按你认识的汉字的顺序教词汇。 [从第 1234 步之后开始]
            {ja:学}是 {fr:Les Kanjis dans la tête} 的第 1234 步。已经学到这里了？Gokan（英文页面）会从这些汉字能读的 5,678 个词开始。 [从第 1234 步之后开始]
            已经学到 {fr:Les Kanjis dans la tête} 的第 1234 步了？Gokan（英文页面）会从这些汉字能读的词开始。 [从第 1234 步之后开始]
            按 {fr:Les Kanjis dans la tête} 的顺序学词汇：认识一个词的所有汉字后，Gokan 就教这个词。 [开始学习（英文）]"
        `);
    });
});
