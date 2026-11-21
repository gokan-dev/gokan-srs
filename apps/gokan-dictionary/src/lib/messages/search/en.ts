// The search script's words in English (./index.ts).

import type { SearchMessages } from './index';

export const enSearch: SearchMessages = {
    loading: 'Loading the dictionary…',
    unavailable: 'Search is unavailable right now.',
    searching: 'Searching…',
    emptyQuery: 'Type a word, a kanji or a grammar point in the search field.',
    groups: { words: 'Words', kanji: 'Kanji', grammar: 'Grammar' },
    sectionHeading: (group, count) => `${group} (${count.toLocaleString('en')})`,
    showAll: (group, count) => `Show all ${count.toLocaleString('en')} ${group === 'kanji' ? 'kanji' : `grammar point${count === 1 ? '' : 's'}`}`,
    seeAll: query => `See all results for “${query}”`,
    resultsFor: query => `Results for “${query}”`,
    resultPages: 'Result pages',
    resultSections: 'Result sections',
    noResults: query => `No results for “${query}”. `,
    searchedAs: { before: 'Searched as ', after: '. ' },
    tryInstead: 'Try kana, kanji or English, or browse the JLPT lists:',
    fromForm: { before: 'from ', after: ' · ' },
    status: count => (count === 0 ? 'No results' : `${count} result${count === 1 ? '' : 's'}`),
    kanjiLevel: level => `JLPT N${level}`,
    inEnglish: 'In English',
    outsideJlpt: 'Outside JLPT',
};
