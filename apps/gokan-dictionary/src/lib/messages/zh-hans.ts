// The dictionary in Simplified Chinese (#170): every word of its chrome and of its titles and
// descriptions, held to the same Messages type as English (./index.ts). Plain, neutral and direct,
// as the English copy is. Its section serves the word pages and the vocabulary lists; a kanji,
// grammar or kanji order page is English's, so the words for those pages here are its titles in
// Chinese for the day the section serves them, and its links to them say they lead to English.

import { headwordOf, secondaryForm } from '@gokan/dataset-schema';
import type { GrammarChapter, GrammarPoint, Kanji, KanjiOrder, Vocabulary } from '@gokan/dataset-schema';
import { searchablePattern, truncate } from '../seo';
import { wordTextSummary } from '../senses';
import type { WordText } from '../types';
import type { CountedNoun, Messages } from './index';

/** The site's name in a Chinese title: the brand as it is, with what it is. */
const SITE_NAME = 'Gokan 日语词典';

/** Titles keep the meaning short: everything past ~30 Chinese characters may be cut. */
const TITLE_MEANING_LENGTH = 24;

const JLPT_LABEL = (level: number) => `N${level}`;

/** Numbers grouped as in English (35,872), whatever the machine building the pages. */
const grouped = (n: number) => n.toLocaleString('en');

const COUNTER: Record<CountedNoun, string> = { word: '个词', stroke: '画', 'grammar point': '个语法点' };

function count(n: number, noun: CountedNoun): string {
    return `${grouped(n)} ${COUNTER[noun]}`;
}

function kanjiRangeHeading(order: KanjiOrder, range: { first: number; last: number }): string {
    return `${order.searchName} 词汇：学完第 ${range.first} 至 ${range.last} 个汉字后能读的词`;
}

/** A word's meaning in Chinese, for its title: its own text's summary, else its first English glosses. */
function meaningOf(vocab: Vocabulary, text: WordText | undefined): string {
    return (text ? wordTextSummary(text) : '') || (vocab.senses[0]?.glosses.slice(0, 2).join(', ') ?? '');
}

export const zhHans: Messages = {
    count,
    kanjiRangeHeading,
    chrome: {
        skipLink: '跳到正文',
        siteTitleWord: '日语词典',
        mainNav: '主导航',
        sections: { vocab: '词汇', kanji: '汉字', grammar: '语法' },
        breadcrumb: '当前位置',
        breadcrumbHome: '词典',
        crumbs: { kanjiOrders: '学习顺序', search: '搜索' },
        footer: links => [
            '数据来自以 CC BY-SA 许可开放的 ',
            { text: 'gokan-dataset', href: links.dataset },
            '（英文）。\n      想用间隔重复记住这些词，可以试试 ',
            { text: 'Gokan SRS', href: links.srs },
            '（英文）。',
        ],
        search: { label: '搜索词典', placeholder: '搜索：汉字、假名、罗马字或英文', results: '搜索结果' },
        hideFurigana: '隐藏注音',
        showFurigana: '显示注音',
        grammarTabs: { label: '浏览语法', level: '按级别', families: '近义语法', curriculum: '课程顺序', conjugations: '活用' },
        inEnglish: '英文',
        languages: '语言',
        pages: '页码',
        allWords: n => `全部 ${grouped(n)} 个词`,
    },
    home: {
        heading: '日语词典',
        lede: '查日语单词的读音、中文释义和例句。汉字和语法页面目前只有英文版。',
        browse: '浏览',
        tiles: {
            vocab: { title: '词汇', meta: '按 JLPT 级别', blurb: '读音、释义、活用和例句。' },
            kanji: kanjiCount => ({ title: '汉字', meta: `${grouped(kanjiCount)} 个汉字 · 英文页面`, blurb: '使用每个汉字的词。' }),
            kanjiOrders: { title: '汉字学习顺序', meta: 'KKLC、RTK 等 · 英文页面', blurb: '按汉字教材的进度，列出每一步能读的词。' },
            grammar: pointCount => ({ title: '语法', meta: `${grouped(pointCount)} 个语法点 · 英文页面`, blurb: '句型、讲解和例句。' }),
        },
        commonWords: '常用词',
        counts: ({ words, kanji, grammar, sentences }) => `${grouped(words)} 个词 · ${grouped(kanji)} 个汉字 · ${grouped(grammar)} 个语法点 · ${grouped(sentences)} 个例句`,
        about: '关于',
        aboutText: links => [
            '本词典基于以 CC BY-SA 许可开放的 ',
            { text: 'gokan-dataset', href: links.dataset },
            '（英文）：日语词条、英文释义和 JLPT 级别来自 JMdict，例句来自 Tatoeba；中文释义来自中文维基词典，中文对应词来自日文维基词典和维基数据，例句的中文翻译来自 Tatoeba。想记住查过的词，可以用 ',
            { text: 'Gokan SRS', href: links.srs },
            '（英文）按间隔重复学习。',
        ],
    },
    vocabIndex: {
        intro: wordCount => `${grouped(wordCount)} 个有中文释义的日语单词，附读音和例句。可以浏览 JLPT 词汇表，或直接搜索。`,
        levelTitle: level => `JLPT ${JLPT_LABEL(level)}`,
        levelBlurbs: {
            5: '日常用词、基础动词和核心词汇。',
            4: '常见的日常词汇，在 N5 的基础上扩展。',
            3: '从初级过渡到中级的词汇。',
            2: '新闻、工作和学习中的词汇。',
            1: '高级和专业词汇。',
        },
    },
    vocabJlpt: {
        heading: (level, page) => `JLPT ${JLPT_LABEL(level)} 词汇${page > 1 ? `，第 ${page} 页` : ''}`,
        levelCrumb: level => `JLPT ${JLPT_LABEL(level)}`,
        pageCrumb: page => `第 ${page} 页`,
        intro: wordCount => `${grouped(wordCount)} 个词，按使用频率排列。`,
        range: (first, last) => `第 ${grouped(first)} 至 ${grouped(last)} 个词。`,
        otherLevels: '其他级别',
        otherLevelsLead: '其他级别：',
        levelLink: JLPT_LABEL,
    },
    vocab: {
        usuallyKana: '通常写作假名。汉字写法',
        alsoRead: '又读',
        alsoWritten: '也写作',
        commonWord: '常用词',
        sections: { meanings: '词义', forms: '活用', sentences: '例句', kanji: '所用汉字', madeOf: '构成', usedIn: '用于' },
        allMeanings: n => `全部 ${n} 个英文释义`,
        rareMeanings: n => `罕用和古旧释义（${n}）`,
        moreExamples: n => `更多例句（${n}）`,
        forms: {
            plain: '简体',
            polite: '敬体',
            present: '现在',
            negative: '否定',
            past: '过去',
            pastNegative: '过去否定',
            labels: {
                plain: '简体',
                polite: '敬体',
                negative: '否定',
                'polite-negative': '敬体否定',
                past: '过去',
                'polite-past': '敬体过去',
                'past-negative': '过去否定',
                'polite-past-negative': '敬体过去否定',
                te: 'て形',
                potential: '可能形',
                passive: '被动形',
                causative: '使役形',
                'causative-passive': '使役被动形',
                volitional: '意志形',
                imperative: '命令形',
                ba: '假定形（ば）',
                tara: '条件形（たら）',
                tai: '愿望（たい）',
                teiru: '进行（ている）',
                teru: '进行，口语（てる）',
            },
        },
        kanjiInEnglish: '汉字页面为英文。',
        credit: sourceNames => `来源：${sourceNames.join('、')}`,
        englishMeaningsSource: 'JMdict（英文释义）',
        sentencesSource: 'Tatoeba',
    },
    sources: { zhwiktionary: '中文维基词典', jawiktionary: '日文维基词典', wikidata: '维基数据', wikipedia: '维基百科', 'tatoeba-cmn': 'Tatoeba', gokan: 'Gokan' },
    meaningGroups: { definitions: '中文释义', equivalents: '中文对应词', english: '英文释义' },
    error: {
        heading: status => (status === 404 ? '找不到页面' : '页面暂时无法显示'),
        explanation: status => (status === 404
            ? '这个地址没有页面。链接可能有误，或者条目已经移动。'
            : '这个页面现在无法显示，请稍后再试。'),
        browse: links => [
            '可以浏览',
            { text: '按 JLPT 级别分类的词汇', href: links.vocab },
            '、',
            { text: '汉字（英文）', href: links.kanji },
            '或',
            { text: '语法点（英文）', href: links.grammar },
            '，或者返回',
            { text: '词典首页', href: links.home },
            '。',
        ],
    },
    meta: {
        home() {
            return {
                title: `${SITE_NAME} - 读音、中文释义和例句`,
                description: '免费日语词典：查日语单词的读音、中文释义、JLPT 级别和真实例句，例句中的每个词都有链接。',
            };
        },
        search() {
            return { title: `搜索 - ${SITE_NAME}`, description: '用汉字、假名、罗马字或英文搜索日语词典。' };
        },
        error(status: number) {
            return status === 404
                ? { title: `找不到页面 - ${SITE_NAME}`, description: '日语词典中没有这个地址的页面。' }
                : { title: `页面暂时无法显示 - ${SITE_NAME}`, description: '日语词典的这个页面暂时无法显示。' };
        },
        // Searched as "思う 意思" or "思う 中文": the word, both spellings, then its meaning in Chinese.
        vocab(vocab: Vocabulary, text?: WordText) {
            const meaning = meaningOf(vocab, text);
            const jlpt = vocab.jlptLevel ? ` | JLPT ${JLPT_LABEL(vocab.jlptLevel)}` : '';
            const label = `${headwordOf(vocab)}（${secondaryForm(vocab)}）`;
            const title = meaning
                ? `${label}的中文意思：${truncate(meaning, TITLE_MEANING_LENGTH)}${jlpt} - ${SITE_NAME}`
                : `${label}的中文意思${jlpt} - ${SITE_NAME}`;
            const description = meaning
                ? `${label}的中文意思是“${meaning}”。读音、全部释义、JLPT 级别，以及每个词都有链接的例句。`
                : `${label}：日语词条，附读音、释义和例句。`;
            return { title, description };
        },
        kanji(kanji: Kanji, vocabCount: number) {
            const jlpt = kanji.steps.jlpt ? `（JLPT ${JLPT_LABEL(kanji.steps.jlpt)}）` : '';
            return {
                title: `${kanji.character} 汉字的读音和用法${jlpt} - ${SITE_NAME}`,
                description: `日语汉字 ${kanji.character}：${count(kanji.strokeCount, 'stroke')}，部件、读音，以及使用它的 ${count(vocabCount, 'word')}。`,
            };
        },
        grammar(point: GrammarPoint) {
            const pattern = searchablePattern(point.title) || point.title;
            return {
                title: `${pattern} 的意思和用法 | JLPT ${JLPT_LABEL(point.jlptLevel)} 语法 - ${SITE_NAME}`,
                description: `${point.title}：JLPT ${JLPT_LABEL(point.jlptLevel)} 日语语法，附接续、讲解和例句。`,
            };
        },
        vocabIndex(vocabCount: number) {
            return {
                title: `日语词汇词典 - ${SITE_NAME}`,
                description: `${grouped(vocabCount)} 个有中文释义的日语单词，附读音、JLPT 级别和例句。可按 JLPT 级别浏览，或直接搜索。`,
            };
        },
        vocabJlpt(level: number, wordCount: number, page = 1) {
            const pageLabel = page > 1 ? `，第 ${page} 页` : '';
            return {
                title: `JLPT N${level} 词汇表（${grouped(wordCount)} 个词）${pageLabel} - ${SITE_NAME}`,
                description: `JLPT N${level} 词汇表${pageLabel}：${grouped(wordCount)} 个词，按使用频率排列，每个词附读音、中文释义和例句。`,
            };
        },
        kanjiIndex(kanjiCount: number) {
            return { title: `按 JLPT 级别排列的汉字表 - ${SITE_NAME}`, description: `全部 ${grouped(kanjiCount)} 个汉字，按 JLPT 级别分组，附使用每个汉字的词。` };
        },
        kanjiOrders(orders: readonly KanjiOrder[]) {
            const named = orders.slice(0, 2).map(order => order.label).join('、');
            return { title: `按汉字学习顺序排列的词汇：${named}等 - ${SITE_NAME}`, description: `${orders.length} 种汉字学习顺序，列出每一步能读的词。` };
        },
        kanjiOrder(order: KanjiOrder, kanjiCount: number, wordCount: number) {
            return {
                title: `${order.searchName} 按汉字进度的词汇表 - ${SITE_NAME}`,
                description: `${order.searchName}：${grouped(kanjiCount)} 个汉字，每 100 个一组，以及学完每一步后能读的 ${count(wordCount, 'word')}。`,
            };
        },
        kanjiRange(order: KanjiOrder, range: { first: number; last: number }, wordCount: number) {
            return {
                title: `${kanjiRangeHeading(order, range)} - ${SITE_NAME}`,
                description: `${order.searchName} 第 ${range.first} 至 ${range.last} 个汉字，以及它们带来的 ${count(wordCount, 'word')}。`,
            };
        },
        grammarIndex(pointCount: number) {
            return { title: `按 JLPT 级别排列的日语语法 - ${SITE_NAME}`, description: `全部 ${pointCount} 个日语语法点，从 N5 到 N1，附接续、讲解和例句。` };
        },
        grammarFamiliesIndex(familyCount: number) {
            return { title: `日语近义语法比较 - ${SITE_NAME}`, description: `${familyCount} 组日语近义语法，每组在单独的页面上比较。` };
        },
        grammarFamily(familyName: string, memberCount: number) {
            return { title: `${familyName} - 日语语法比较 - ${SITE_NAME}`, description: `${familyName}：${memberCount} 个相关的日语语法点并列比较。` };
        },
        grammarChaptersIndex(chapterCount: number, pointCount: number) {
            return { title: `日语语法课程：${chapterCount} 章 - ${SITE_NAME}`, description: `从 N5 到 N1 的语法教学顺序：${chapterCount} 章，共 ${pointCount} 个语法点。` };
        },
        grammarChapter(chapter: GrammarChapter) {
            return { title: `${chapter.title} - 语法章节 - ${SITE_NAME}`, description: `${chapter.title}：本章一起讲解的 ${count(chapter.points.length, 'grammar point')}。` };
        },
        grammarConjugationsIndex(formCount: number, pointCount: number) {
            return { title: `日语动词和形容词活用表 - ${SITE_NAME}`, description: `${formCount} 种活用形，共 ${pointCount} 个活用句型，每种附完整的例词表。` };
        },
    },
};
