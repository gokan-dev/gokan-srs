// The search script's words in Simplified Chinese (./index.ts). Chinese's index finds words by
// their kanji, kana, romaji or Chinese meaning; kanji and grammar have no Chinese page yet (#170).

import type { SearchMessages } from './index';

export const zhHansSearch: SearchMessages = {
    loading: '正在加载词典…',
    unavailable: '搜索暂时无法使用。',
    searching: '正在搜索…',
    emptyQuery: '在搜索框中输入日语单词、假名、罗马字或中文意思。',
    groups: { words: '词汇', kanji: '汉字', grammar: '语法' },
    wordsHeading: count => `词汇（${count.toLocaleString('en')}）`,
    seeAll: query => `查看“${query}”的全部结果`,
    resultsFor: query => `“${query}”的搜索结果`,
    resultPages: '结果页码',
    noResults: query => `没有找到“${query}”。`,
    searchedAs: { before: '已按 ', after: ' 搜索。' },
    tryInstead: '可以试试汉字、假名、罗马字或中文，或浏览 JLPT 词表：',
    fromForm: { before: '', after: ' 的原形 · ' },
    status: count => (count === 0 ? '没有结果' : `${count} 个结果`),
    kanjiLevel: level => `JLPT N${level}`,
    outsideJlpt: '不在 JLPT 范围内',
};
