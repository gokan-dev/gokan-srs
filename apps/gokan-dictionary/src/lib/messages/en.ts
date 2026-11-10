// The dictionary in English: every word of its chrome (header, footer, breadcrumb, search field,
// tabs, the error page) and of its titles and descriptions. The site's first locale; another is
// one more module like this one, held to the same Messages type (./index.ts).

import { headwordOf, secondaryForm } from '@gokan/dataset-schema';
import type { GrammarChapter, GrammarPoint, Kanji, KanjiOrder, Vocabulary } from '@gokan/dataset-schema';
import { FORM_LABELS } from '../conjugation';
import { quotedGlosses, searchablePattern, sentenceCase, truncate } from '../seo';
import { SITE_NAME } from '../site';
import type { CountedNoun, Messages } from './index';

const JLPT_LABEL = (level: number) => `N${level}`;

// Titles lead with the words a learner types ("思う meaning", "を問わず meaning", "て-form
// conjugation") and put the English meaning on the result line itself: Search Console showed
// the old Japanese-only titles surfacing almost solely for Japanese-language queries, where
// the big Japanese dictionaries win. Everything past ~60 chars may be cut, so the site name
// goes last.
const TITLE_MEANING_LENGTH = 40;

/** `n` with `noun` in the singular for exactly one, else with an s; the number grouped as in English. */
function count(n: number, noun: CountedNoun): string {
    return `${n.toLocaleString('en')} ${noun}${n === 1 ? '' : 's'}`;
}

/** A range page's heading, and its title without the site name: the two say the same thing. */
function kanjiRangeHeading(order: KanjiOrder, range: { first: number; last: number }): string {
    return `${order.searchName} vocabulary: words you can read after kanji ${range.first} to ${range.last}`;
}

export const en: Messages = {
    count,
    kanjiRangeHeading,
    chrome: {
        skipLink: 'Skip to content',
        siteTitleWord: 'Dictionary',
        mainNav: 'Main',
        sections: { vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' },
        breadcrumb: 'Breadcrumb',
        breadcrumbHome: 'Dictionary',
        crumbs: { kanjiOrders: 'Orders', search: 'Search' },
        // The line break is the one every page has carried since the footer was written: a change
        // to it changes all 40k pages, re-uploaded on the next deploy.
        footer: links => [
            'Data from the open, CC BY-SA-licensed ',
            { text: 'gokan-dataset', href: links.dataset },
            '.\n      To learn these words with spaced repetition, try ',
            { text: 'Gokan SRS', href: links.srs },
            '.',
        ],
        search: { label: 'Search the dictionary', placeholder: 'Search: kanji, kana, romaji or English', results: 'Search results' },
        hideFurigana: 'Hide furigana',
        showFurigana: 'Show furigana',
        grammarTabs: { label: 'Browse grammar', level: 'By level', families: 'Families', curriculum: 'Curriculum', conjugations: 'Conjugations' },
        // Never shown: every page an English page links is in English.
        inEnglish: 'In English',
        languages: 'Language',
        pages: 'Pages',
        allWords: n => `All ${n.toLocaleString('en')} words`,
    },
    home: {
        heading: 'Japanese dictionary',
        lede: 'Look up a word, a kanji or a grammar point, with readings, meanings and example sentences.',
        browse: 'Browse',
        tiles: {
            vocab: { title: 'Vocabulary', meta: 'By JLPT level', blurb: 'Readings, meanings, forms and example sentences.' },
            kanji: kanjiCount => ({ title: 'Kanji', meta: `${kanjiCount.toLocaleString('en')} characters`, blurb: 'The words that use each character.' }),
            kanjiOrders: { title: 'Kanji learning orders', meta: 'KKLC, RTK and more', blurb: 'The words you can read at each step of your kanji book.' },
            grammar: pointCount => ({ title: 'Grammar', meta: `${pointCount.toLocaleString('en')} points`, blurb: 'Patterns, explanations and worked examples.' }),
        },
        commonWords: 'Common words',
        counts: ({ words, kanji, grammar, sentences }) => `${words.toLocaleString('en')} words · ${kanji.toLocaleString('en')} kanji · ${grammar.toLocaleString('en')} grammar points · ${sentences.toLocaleString('en')} example sentences`,
        about: 'About',
        aboutText: links => [
            'Built on the open, CC BY-SA-licensed ',
            { text: 'gokan-dataset', href: links.dataset },
            ': JMdict definitions, Tatoeba sentences and JLPT levels. To remember what you look up, learn it with spaced repetition in ',
            { text: 'Gokan SRS', href: links.srs },
            '.',
        ],
    },
    vocabIndex: {
        intro: wordCount => `${wordCount.toLocaleString('en')} words with readings, meanings and example sentences. Browse the JLPT lists, or search for any word.`,
        levelTitle: level => `JLPT ${JLPT_LABEL(level)}`,
        levelBlurbs: {
            5: 'Everyday words, basic verbs and core vocabulary.',
            4: 'Common daily vocabulary, building on N5.',
            3: 'The bridge to intermediate Japanese.',
            2: 'Vocabulary for news, work and study.',
            1: 'Advanced and specialised vocabulary.',
        },
    },
    vocabJlpt: {
        heading: (level, page) => `JLPT ${JLPT_LABEL(level)} vocabulary${page > 1 ? `, page ${page}` : ''}`,
        levelCrumb: level => `JLPT ${JLPT_LABEL(level)}`,
        pageCrumb: page => `Page ${page}`,
        intro: wordCount => `${wordCount.toLocaleString('en')} words, most frequent first.`,
        range: (first, last) => `Words ${first.toLocaleString('en')} to ${last.toLocaleString('en')}.`,
        otherLevels: 'Other levels',
        otherLevelsLead: 'Other levels:',
        levelLink: JLPT_LABEL,
    },
    vocab: {
        usuallyKana: 'Usually written in kana. Kanji spelling',
        alsoRead: 'also',
        alsoWritten: 'Also written',
        commonWord: 'Common word',
        sections: { meanings: 'Meanings', forms: 'Forms', sentences: 'Example sentences', kanji: 'Kanji used', madeOf: 'Made of', usedIn: 'Used in' },
        allMeanings: n => `All ${n} meanings`,
        rareMeanings: n => `Rare and archaic meanings (${n})`,
        moreExamples: n => `More examples (${n})`,
        forms: { plain: 'Plain', polite: 'Polite', present: 'Present', negative: 'Negative', past: 'Past', pastNegative: 'Past negative', labels: FORM_LABELS },
        kanjiInEnglish: 'Kanji pages are in English.',
        credit: sourceNames => `Sources: ${sourceNames.join(', ')}`,
        englishMeaningsSource: 'JMdict',
        sentencesSource: 'Tatoeba',
    },
    sources: { zhwiktionary: 'Chinese Wiktionary', jawiktionary: 'Japanese Wiktionary', wikidata: 'Wikidata', wikipedia: 'Wikipedia', 'tatoeba-cmn': 'Tatoeba', gokan: 'Gokan' },
    meaningGroups: { definitions: 'Definitions', equivalents: 'Equivalents', english: 'English meanings' },
    error: {
        heading: status => (status === 404 ? 'Page not found' : 'Page unavailable'),
        explanation: status => (status === 404
            ? 'There is no page at this address. The link may be mistyped, or the entry may have moved.'
            : 'This page could not be shown just now. Try again in a moment.'),
        browse: links => [
            'Browse the ',
            { text: 'vocabulary by JLPT level', href: links.vocab },
            ', the ',
            { text: 'kanji', href: links.kanji },
            ' or the ',
            { text: 'grammar points', href: links.grammar },
            ', or go to the ',
            { text: 'dictionary home', href: links.home },
            '.',
        ],
    },
    meta: {
        home() {
            return {
                title: `${SITE_NAME} - Japanese Dictionary with Example Sentences`,
                description: 'Free Japanese dictionary: look up any word, kanji, or grammar point. Readings, English meanings, JLPT levels, and real example sentences with every word linked.',
            };
        },
        /** The search results page: kept out of search engines (noindex), but it still needs a title. */
        search() {
            return {
                title: `Search - ${SITE_NAME}`,
                description: 'Search the Japanese dictionary in kanji, kana, romaji or English.',
            };
        },
        /** A page that could not be shown: no such page (404), or a failure (any other status). Never indexed. */
        error(status: number) {
            return status === 404
                ? { title: `Page not found - ${SITE_NAME}`, description: 'There is no page at this address in the Japanese dictionary.' }
                : { title: `Page unavailable - ${SITE_NAME}`, description: 'This page of the Japanese dictionary could not be shown.' };
        },
        vocab(vocab: Vocabulary) {
            const meaning = vocab.senses[0]?.glosses.slice(0, 2).join(', ');
            const jlpt = vocab.jlptLevel ? ` | JLPT ${JLPT_LABEL(vocab.jlptLevel)}` : '';
            // "思う (おもう)", or "ここ (此処)" for a word learned in kana: both spellings stay searchable.
            const label = `${headwordOf(vocab)} (${secondaryForm(vocab)})`;

            const title = meaning
                ? `${label} meaning: ${truncate(meaning, TITLE_MEANING_LENGTH)}${jlpt} - ${SITE_NAME}`
                : `${label} meaning${jlpt} - ${SITE_NAME}`;
            const description = meaning
                ? `${label} means "${meaning}" in English. Readings, every meaning, JLPT level, and example sentences with each word linked.`
                : `${label}: Japanese dictionary entry with readings, meanings, and example sentences.`;

            return { title, description };
        },
        kanji(kanji: Kanji, vocabCount: number) {
            const jlpt = kanji.steps.jlpt ? ` (JLPT ${JLPT_LABEL(kanji.steps.jlpt)})` : '';
            // Searched as "学 kanji meaning": the character, the word "kanji", then what it means.
            const meaning = kanji.meanings.slice(0, 3).join(', ');
            const title = meaning
                ? `${kanji.character} kanji meaning: ${truncate(meaning, TITLE_MEANING_LENGTH)}${jlpt} - ${SITE_NAME}`
                : `${kanji.character} kanji${jlpt} - ${SITE_NAME}`;

            // Readings as typed into a search box: まな.ぶ is まなぶ, a suffix reading's dash dropped.
            const readings = [...new Set([...kanji.readings.on, ...kanji.readings.kun.map(reading => reading.replace(/[.-]/g, ''))])].slice(0, 4);
            const opening = meaning ? `The kanji ${kanji.character} means "${meaning}"` : `The kanji ${kanji.character}`;
            const read = readings.length > 0 ? `, read ${readings.join(', ')}` : '';
            const strokes = count(kanji.strokeCount, 'stroke');
            const words = vocabCount > 0 ? `, and the ${vocabCount} word${vocabCount === 1 ? ' that uses' : 's that use'} it` : '';
            const description = `${opening}${read}. Its ${strokes}, components and readings${words}.`;

            return { title, description };
        },
        grammar(point: GrammarPoint) {
            const level = `JLPT ${JLPT_LABEL(point.jlptLevel)} grammar`;
            let title: string;
            if (point.kind === 'inflection' && point.derives) {
                // A conjugation is searched by its name ("causative form", "te-form"), not its pattern.
                title = `${sentenceCase(point.derives)} conjugation and usage | ${level} - ${SITE_NAME}`;
            } else {
                const pattern = searchablePattern(point.title) || point.title;
                const romaji = point.romaji ? searchablePattern(point.romaji) : '';
                const gloss = quotedGlosses(point.shortExplanation);
                const label = romaji ? `${pattern} (${romaji})` : pattern;
                title = gloss
                    ? `${label} meaning: ${truncate(gloss, TITLE_MEANING_LENGTH)} | ${level} - ${SITE_NAME}`
                    : `${label} meaning and usage | ${level} - ${SITE_NAME}`;
            }

            // The short explanation is already a one-line summary written for a learner, so it makes a
            // better meta description than anything synthesised from the other fields. Trimmed to keep
            // the whole description inside the ~155 chars Google typically renders.
            const summary = point.shortExplanation.replace(/\s+/g, ' ').trim();
            const description = `${point.title}: ${truncate(summary, 120)} JLPT ${JLPT_LABEL(point.jlptLevel)} Japanese grammar with formation and example sentences.`;

            return { title, description };
        },
        vocabIndex(vocabCount: number) {
            return {
                title: `Japanese Vocabulary Dictionary - ${SITE_NAME}`,
                description: `${vocabCount.toLocaleString('en')} Japanese words with readings, English meanings, JLPT levels, and example sentences. Browse by JLPT level or search.`,
            };
        },
        /** A JLPT list page; pages after the first say which page they are, so their titles stay distinct. */
        vocabJlpt(level: number, wordCount: number, page = 1) {
            const pageLabel = page > 1 ? `, page ${page}` : '';
            return {
                title: `JLPT N${level} Vocabulary List (${wordCount.toLocaleString('en')} words)${pageLabel} - ${SITE_NAME}`,
                description: `The complete JLPT N${level} vocabulary list${pageLabel}: ${wordCount.toLocaleString('en')} words ordered by frequency, each with its reading, English meaning, and example sentences.`,
            };
        },
        kanjiIndex(kanjiCount: number) {
            return {
                title: `Kanji List by JLPT Level - ${SITE_NAME}`,
                description: `All ${kanjiCount.toLocaleString('en')} kanji, grouped by JLPT level, each with its KKLC step and the vocabulary that uses it.`,
            };
        },
        kanjiOrders(orders: readonly KanjiOrder[]) {
            const named = orders.slice(0, 2).map(order => order.label).join(', ');
            return {
                title: `Vocabulary by kanji learning order: ${named} and more - ${SITE_NAME}`,
                description: `${orders.length} kanji learning orders, ${named} among them, with the words you can read at each step: every word listed at the step of its last kanji.`,
            };
        },
        kanjiOrder(order: KanjiOrder, kanjiCount: number, wordCount: number) {
            const name = order.searchName;
            return {
                title: `${name} vocabulary list by kanji step - ${SITE_NAME}`,
                description: `${name} (${order.description}): ${kanjiCount.toLocaleString('en')} kanji in steps of 100, and the ${count(wordCount, 'word')} you can read after each, every word at the step of its last kanji.`,
            };
        },
        kanjiRange(order: KanjiOrder, range: { first: number; last: number }, wordCount: number) {
            const name = order.searchName;
            const kanjiCount = range.last - range.first + 1;
            return {
                title: `${kanjiRangeHeading(order, range)} - ${SITE_NAME}`,
                description: `The ${kanjiCount} kanji of ${name} steps ${range.first} to ${range.last} and the ${count(wordCount, 'word')} they unlock, under the kanji that completes each, most frequent first, with readings and meanings.`,
            };
        },
        grammarIndex(pointCount: number) {
            return {
                title: `Japanese Grammar Points by JLPT Level - ${SITE_NAME}`,
                description: `All ${pointCount} Japanese grammar points, organized from JLPT N5 to N1, each with its formation pattern, explanation, and example sentences.`,
            };
        },
        grammarFamiliesIndex(familyCount: number) {
            return {
                title: `Japanese Grammar Families: Near-Synonyms Compared - ${SITE_NAME}`,
                description: `${familyCount} groups of Japanese grammar near-synonyms, such as でも, しかし and けれども, each compared on its own page.`,
            };
        },
        grammarFamily(familyName: string, memberCount: number) {
            return {
                title: `${familyName} - Japanese Grammar Comparison - ${SITE_NAME}`,
                description: `${familyName}: ${memberCount} related Japanese grammar points compared side by side, with guidance on which one to reach for and why.`,
            };
        },
        grammarChaptersIndex(chapterCount: number, pointCount: number) {
            return {
                title: `Japanese Grammar Curriculum - ${chapterCount} Chapters - ${SITE_NAME}`,
                description: `The full JLPT N5-N1 grammar teaching order: ${chapterCount} chapters covering ${pointCount} grammar points, grouped the way they are actually taught together.`,
            };
        },
        grammarChapter(chapter: GrammarChapter) {
            const title = `${chapter.title} - Grammar Chapter ${chapter.jlptLevel ? `(N${chapter.jlptLevel})` : ''} - ${SITE_NAME}`;
            const summary = chapter.summary.replace(/\s+/g, ' ').trim();
            const description = `${chapter.title}: ${truncate(summary, 120)} ${count(chapter.points.length, 'grammar point')} taught together in this chapter.`;

            return { title, description };
        },
        grammarConjugationsIndex(formCount: number, pointCount: number) {
            return {
                title: `Japanese Verb and Adjective Conjugation Reference - ${SITE_NAME}`,
                description: `${formCount} conjugation forms across ${pointCount} inflection patterns (te-form, potential, causative, and more), each with a full table of example verbs and adjectives.`,
            };
        },
    },
};
