// The dictionary in English: every word of its chrome (header, footer, breadcrumb, search field,
// tabs, the error page) and of its titles and descriptions. The site's first locale; another is
// one more module like this one, held to the same Messages type (./index.ts).

import { CLOSENESS_LABEL, FORM_LABELS, headwordOf, pitchAccentLabel, secondaryForm } from '@gokan/dataset-schema';
import type { GrammarChapter, GrammarPoint, Kanji, KanjiOrder, Vocabulary } from '@gokan/dataset-schema';
import { orderNameLang } from '../kanjiOrders';
import { firstGloss, romajiOf } from '../romaji';
import type { RomajiSpoken } from '../romaji';
import { quotedGlosses, searchablePattern, sentenceCase, truncate } from '../seo';
import { SITE_NAME } from '../site';
import type { VocabSummary } from '../types';
import type { CountedNoun, LinkedText, Messages } from './index';

const jlptLevel = (level: number) => `N${level}`;
const jlptLabel = (level: number) => `JLPT ${jlptLevel(level)}`;
/**
 * Pitch accent words kept whole by no-break spaces, for the romaji page's narrow note, where
 * "Pitch accent:" ended one line and "heiban" began the next, or "drop after / mora 2" split: the
 * note then breaks only at a " · ", or after the "or" between two patterns, too wide together
 * for a phone. Not in the shared pitchAccentLabel: it is also both apps' screen-reader label.
 */
const nonBreakingPitch = (words: string) => words.replaceAll(' ', '\u00a0').replaceAll(',\u00a0or\u00a0', ', or ');

// Titles lead with the words a learner types ("思う meaning", "を問わず meaning", "て-form
// conjugation") and put the English meaning on the result line itself: Search Console showed
// the old Japanese-only titles surfacing almost solely for Japanese-language queries, where
// the big Japanese dictionaries win. Everything past ~60 chars may be cut, so the site name
// goes last.
const TITLE_MEANING_LENGTH = 40;
/**
 * What a romaji page's title lists words up to, past its first two (the point of the page is that
 * there are several): about what a result shows, the site name past it allowed to be cut.
 */
const ROMAJI_TITLE_LENGTH = 70;

/**
 * The end of a romaji page's intro: what tells its words apart when spoken. Words whose kana differ
 * (きんえん, きねん: both "kinen") are told apart by them, never "only the context"; when some share
 * their kana, the readings are credited only with some.
 */
const SPOKEN_APART: Record<RomajiSpoken, string> = {
    readings: '; spoken, their readings do.',
    differs: '; spoken, their pitch accent does.',
    same: '; spoken, only the context does.',
    unknown: '.',
    // Some kana in common (人員 じんいん, 辞任 じにん, 自認 じにん): the readings tell only some apart.
    'partly-differs': '; spoken, their readings tell some of them apart, and their pitch accent the rest.',
    'partly-same': '; spoken, their readings tell some of them apart, and only the context the rest.',
    'partly-unknown': '; spoken, their readings tell some of them apart.',
};

/** `n` with `noun` in the singular for exactly one, else with an s; the number grouped as in English. */
function count(n: number, noun: CountedNoun): string {
    return `${n.toLocaleString('en')} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * An order named in a sentence: its prose name (`proseName`, "the kanji frequency order", "KKLC"),
 * never its short label ("Frequency") or its search name, which is capitalised for a title. A
 * name in another language (Maniette's French title) is a run marked with it.
 */
function orderInProse(order: KanjiOrder): LinkedText {
    const lang = orderNameLang(order);
    return lang === 'en' ? [order.proseName] : [{ text: order.proseName, lang }];
}

/** A sentence from its runs, the plain ones next to each other joined into one. */
function sentence(...runs: (string | LinkedText)[]): LinkedText {
    const joined: LinkedText[number][] = [];
    for (const run of runs.flat()) {
        const last = joined.at(-1);
        if (typeof run === 'string' && typeof last === 'string') joined[joined.length - 1] = last + run;
        else if (run !== '') joined.push(run);
    }
    return joined;
}

/** A count opening a sentence: spelled out to ten ("Three words"), in figures past it. */
function countAtStart(n: number, noun: CountedNoun): string {
    const spelled = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n];
    return spelled === undefined ? count(n, noun) : `${spelled} ${noun}${n === 1 ? '' : 's'}`;
}

/** How common a word is, by its round top: "Top 5,000 words" (a word page's facts, a romaji page's rows). */
function frequencyReference(top: { top: number; beyond: boolean } | null): string {
    return top === null ? 'Not in the frequency list' : top.beyond ? `Beyond the top ${top.top.toLocaleString('en')}` : `Top ${top.top.toLocaleString('en')} words`;
}

/** A word on a romaji page's title: "橋 (bridge)", or the word alone with no gloss. */
function wordWithGloss(word: VocabSummary): string {
    const gloss = firstGloss(word.gloss);
    return gloss ? `${word.word} (${gloss})` : word.word;
}

/** A range page's heading, and its title without the site name: the two say the same thing. */
function kanjiRangeHeading(order: KanjiOrder, range: { first: number; last: number }): string {
    return `${order.searchName} vocabulary: words you can read after kanji ${range.first} to ${range.last}`;
}

export const en: Messages = {
    count,
    kanjiRangeHeading,
    jlptLabel,
    jlptLevel,
    chrome: {
        skipLink: 'Skip to content',
        siteTitleWord: 'Dictionary',
        mainNav: 'Main',
        sections: { vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' },
        breadcrumb: 'Breadcrumb',
        breadcrumbHome: 'Dictionary',
        crumbs: { kanjiOrders: 'Orders', search: 'Search' },
        // The line break is the footer's original source indentation, kept so its output stays as
        // it was. A change here re-uploads the prerendered list pages; the word, kanji and grammar
        // pages render on request (#209) and pick it up as CloudFront refreshes them.
        footer: links => [
            'Data from the open, CC BY-SA-licensed ',
            { text: 'gokan-dataset', href: links.dataset },
            '.\n      To learn these words with spaced repetition, try ',
            { text: 'Gokan SRS', ...links.srs },
            '.',
        ],
        search: { label: 'Search the dictionary', placeholder: 'Search words, kanji and grammar', results: 'Search results' },
        hideFurigana: 'Hide furigana',
        showFurigana: 'Show furigana',
        play: word => `Play ${word}`,
        playSentence: 'Play sentence',
        voiceCredit: credit => ['Audio: ', { text: credit.text, lang: 'ja', href: credit.href }, '.'],
        grammarTabs: { label: 'Browse grammar', level: 'By level', families: 'Families', curriculum: 'Curriculum', conjugations: 'Conjugations' },
        // Never shown: every page an English page links is in English.
        inEnglish: 'In English',
        languages: 'Language',
        pages: 'Pages',
        allWords: n => `All ${n.toLocaleString('en')} words`,
    },
    home: {
        heading: 'Japanese dictionary',
        lede: 'Look up any word, kanji or grammar point, or see the words each step of your kanji book unlocks.',
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
            ': JMdict definitions, Tatoeba sentences, JLPT levels, and pitch accents from Wiktionary and UniDic. To remember what you look up, learn it with spaced repetition in ',
            { text: 'Gokan SRS', ...links.srs },
            '.',
        ],
        appHeading: 'Learn with Gokan SRS',
    },
    appPanel: {
        word: (word, { order, step }) => ({
            text: sentence('You can read ', [{ text: word, lang: 'ja' }], ` after step ${step} of `, orderInProse(order), '. Gokan teaches words in the order of the kanji you know.'),
            action: `Start after step ${step}`,
        }),
        kanji: (character, { order, step }, unlocked) => ({
            text: sentence([{ text: character, lang: 'ja' }], ` is step ${step} of `, orderInProse(order), `. Know this far? Gokan starts you with the ${count(unlocked, 'word')} those kanji unlock.`),
            action: `Start after step ${step}`,
        }),
        range: ({ order, step }) => ({
            text: sentence('Know ', orderInProse(order), ` up to step ${step}? Gokan starts you with the words those kanji unlock.`),
            action: `Start after step ${step}`,
        }),
        order: order => ({
            text: sentence('Study vocabulary with ', orderInProse(order), ': Gokan teaches each word once you know its kanji.'),
            action: 'Start with this order',
        }),
        grammar: {
            text: ['Practice this pattern as fill-in-the-blank on real sentences, on its own review schedule.'],
            action: 'Try Gokan SRS',
        },
        home: {
            text: ['Tell Gokan your kanji book and how far you are, and it schedules the words you can read, with example sentences and grammar practice.'],
            action: 'Try Gokan SRS',
        },
        general: {
            text: ['Gokan teaches Japanese vocabulary in the order of the kanji you know, with spaced repetition.'],
            action: 'Try Gokan SRS',
        },
    },
    vocabIndex: {
        intro: wordCount => `${wordCount.toLocaleString('en')} words with readings, meanings and example sentences. Browse the JLPT lists, or search for any word.`,
        levelBlurbs: {
            5: 'Everyday words, basic verbs and core vocabulary.',
            4: 'Common daily vocabulary, building on N5.',
            3: 'The bridge to intermediate Japanese.',
            2: 'Vocabulary for news, work and study.',
            1: 'Advanced and specialised vocabulary.',
        },
    },
    vocabJlpt: {
        heading: (level, page) => `${jlptLabel(level)} vocabulary${page > 1 ? `, page ${page}` : ''}`,
        pageCrumb: page => `Page ${page}`,
        intro: wordCount => `${wordCount.toLocaleString('en')} words, most frequent first.`,
        range: (first, last) => `Words ${first.toLocaleString('en')} to ${last.toLocaleString('en')}.`,
        otherLevels: 'Other levels',
        otherLevelsLead: 'Other levels:',
    },
    detailTabs: {
        label: 'Sections', dict: 'Dict', sentences: 'Sentences', synonyms: 'Synonyms', kanji: 'Kanji', related: 'Related',
        words: 'Words', point: 'Point', examples: 'Examples',
    },
    kanji: {
        wordsSearch: { label: 'Search the words', placeholder: 'Search the words', note: englishRows => `English searches the first ${englishRows.toLocaleString('en')} words.` },
    },
    grammar: {
        allExamples: n => `All ${n.toLocaleString('en')} examples`,
        examplesSearch: { label: 'Search the examples', placeholder: 'English or Japanese' },
    },
    vocab: {
        usuallyKana: 'Usually written in kana. Kanji spelling',
        alsoRead: 'also',
        alsoWritten: 'Also written',
        // The words the app's screen readers say too (@gokan/dataset-schema), so the two never drift.
        pitchAccent: pitchAccentLabel,
        sections: {
            meanings: 'Meanings', commonPatterns: 'Common patterns', examples: 'Examples', closestSynonyms: 'Closest synonyms', sentences: 'Sentences', synonyms: 'Synonyms',
            forms: 'Forms', kanji: 'Kanji', related: 'Related', madeOf: 'Made of', usedIn: 'Used in',
        },
        showAllMeanings: n => `Show all ${n} meanings`,
        rareMeanings: n => `Rare and archaic meanings (${n})`,
        showMore: n => `Show ${n.toLocaleString('en')} more`,
        showMoreMeanings: n => `Show ${n} more ${n === 1 ? 'meaning' : 'meanings'}`,
        forMeaning: n => `For meaning ${n}`,
        synonymsNotListed: n => `${count(n, 'synonym')} more, less close, not listed here.`,
        // The app's own words (CLOSENESS_LABEL), so the two products label a pair alike.
        closeness: { interchangeable: CLOSENESS_LABEL.interchangeable.label, close: CLOSENESS_LABEL.close.label, distinct: CLOSENESS_LABEL.distinct.label },
        howCommon: {
            label: 'How common',
            bands: { 'Very common': 'Very common', Common: 'Common', 'Less common': 'Less common', Rare: 'Rare' },
            reference: frequencyReference,
        },
        textbooks: 'Textbooks',
        search: {
            placeholders: { sentences: 'English or Japanese', synonyms: 'English or Japanese', related: 'English or Japanese' },
            sentences: 'Search sentences', synonyms: 'Search synonyms', related: 'Search related words',
        },
        forms: { plain: 'Plain', polite: 'Polite', present: 'Present', negative: 'Negative', past: 'Past', pastNegative: 'Past negative', labels: FORM_LABELS },
        kanjiInEnglish: 'Kanji pages are in English.',
        credit: sourceNames => `Sources: ${sourceNames.join(', ')}`,
        englishMeaningsSource: 'JMdict',
        sentencesSource: 'Tatoeba',
        sharedRomaji: (romaji, others, more) => sentence(
            'Also read ',
            [{ text: romaji.text, href: romaji.href, lang: 'ja-Latn' }],
            ': ',
            others.flatMap((other, at): LinkedText => [at > 0 ? ', ' : '', { text: other.word, href: other.href, lang: 'ja' }, other.gloss ? ` ${other.gloss}` : '']),
            more > 0 ? `, and ${more.toLocaleString('en')} more` : '',
        ),
    },
    romajiPage: {
        heading: romaji => [{ text: romaji, lang: 'ja-Latn' }, ' in Japanese'],
        intro: (n, readings, romaji, spoken) => sentence(
            `${countAtStart(n, 'word')} are read `,
            readings.flatMap((reading, at): LinkedText => [at > 0 ? ' or ' : '', { text: reading, lang: 'ja' }]),
            ` (${romaji}). Written, their spelling tells them apart`,
            SPOKEN_APART[spoken],
        ),
        note: ({ jlpt, top, downsteps }) => [...(jlpt ? [jlptLevel(jlpt)] : []), frequencyReference(top), ...(downsteps ? [nonBreakingPitch(pitchAccentLabel(downsteps))] : [])].join(' · '),
        outro: "Each word's page has its meanings, example sentences and kanji.",
    },
    sources: { zhwiktionary: 'Chinese Wiktionary', jawiktionary: 'Japanese Wiktionary', wikidata: 'Wikidata', wikipedia: 'Wikipedia', 'tatoeba-cmn': 'Tatoeba', gokan: 'Gokan' },
    meaningGroups: { definitions: 'Definitions', equivalents: 'Equivalents', english: 'English meanings' },
    searchPage: {
        heading: 'Search',
        noScript: links => [
            'Search needs JavaScript. You can still browse the ',
            { text: 'vocabulary by JLPT level', href: links.vocab },
            ', the ',
            { text: 'kanji', href: links.kanji },
            ' or the ',
            { text: 'grammar points', href: links.grammar },
            '.',
        ],
    },
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
                title: `Japanese Dictionary by the Kanji You Know: KKLC, RTK and JLPT - ${SITE_NAME}`,
                description: 'Free Japanese dictionary that follows your kanji book: the words you can read at each step of KKLC, RTK and more. Readings, English meanings, JLPT levels and example sentences.',
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
            const jlpt = vocab.jlptLevel ? ` | ${jlptLabel(vocab.jlptLevel)}` : '';
            // "思う (おもう)", or "ここ (此処)" for a word learned in kana: both spellings stay searchable.
            const label = `${headwordOf(vocab)} (${secondaryForm(vocab)})`;
            // The description opens with the romaji too, which learners who do not read kana search
            // by (#278): "勉強 (べんきょう, benkyou)". The title stays as it is, at its length limit.
            const described = `${headwordOf(vocab)} (${secondaryForm(vocab)}, ${romajiOf(vocab.reading.primary)})`;

            const title = meaning
                ? `${label} meaning: ${truncate(meaning, TITLE_MEANING_LENGTH)}${jlpt} - ${SITE_NAME}`
                : `${label} meaning${jlpt} - ${SITE_NAME}`;
            const description = meaning
                ? `${described} means "${meaning}" in English. Readings, every meaning, JLPT level, and example sentences with each word linked.`
                : `${described}: Japanese dictionary entry with readings, meanings, and example sentences.`;

            return { title, description };
        },
        kanji(kanji: Kanji, vocabCount: number) {
            const jlpt = kanji.steps.jlpt ? ` (${jlptLabel(kanji.steps.jlpt)})` : '';
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
            const level = `${jlptLabel(point.jlptLevel)} grammar`;
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
            const description = `${point.title}: ${truncate(summary, 120)} ${jlptLabel(point.jlptLevel)} Japanese grammar with formation and example sentences.`;

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
                title: `${jlptLabel(level)} Vocabulary List (${wordCount.toLocaleString('en')} words)${pageLabel} - ${SITE_NAME}`,
                description: `The complete ${jlptLabel(level)} vocabulary list${pageLabel}: ${wordCount.toLocaleString('en')} words ordered by frequency, each with its reading, English meaning, and example sentences.`,
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
        romaji(romaji: string, words: readonly VocabSummary[]) {
            // The two most frequent words, then as many more as fit (ROMAJI_TITLE_LENGTH).
            const lead = `${romaji} in Japanese: `;
            const tail = ` - ${SITE_NAME}`;
            const named: string[] = [];
            for (const word of words) {
                const next = [...named, wordWithGloss(word)].join(', ');
                if (named.length >= 2 && lead.length + next.length + tail.length > ROMAJI_TITLE_LENGTH) break;
                named.push(wordWithGloss(word));
            }
            // "橋 (はし, bridge)": the kana for a word written with kanji, then its first gloss.
            const listed = words.map(word => {
                const said = [word.reading ?? '', firstGloss(word.gloss)].filter(part => part !== '').join(', ');
                return said ? `${word.word} (${said})` : word.word;
            }).join(', ');
            return {
                title: `${lead}${named.join(', ')}${tail}`,
                description: `${romaji} can be ${count(words.length, 'word')} in Japanese: ${truncate(listed, 100)}. Their meanings, JLPT levels, how common each is, and their pitch accent.`,
            };
        },
    },
};
