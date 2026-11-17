// What the dictionary says, per locale: one typed module per locale (./en.ts), every one held to
// `Messages`, so a catalog missing a key, or a served locale with no catalog, does not build. No
// runtime i18n library: a page reads its catalog as plain values and functions (its locale's,
// from pages/pageLocale.ts, set by the root layout, or messagesFor on the server).
//
// Text the dataset holds (meanings, explanations, examples) is the dataset's, read in the
// locale's language (lib/locale.ts, datasetLanguageOf); this is everything else.

import type { Closeness, FrequencyBandName, GrammarChapter, GrammarPoint, Kanji, KanjiOrder, Vocabulary } from '@gokan/dataset-schema';
import type { DictionaryPlacement } from '@gokan/analytics';
import type { AppLink } from '../appLinks';
import type { FormLabel } from '../conjugation';
import type { OrderStep } from '../kanjiOrders';
import type { ServedLocale } from '../locale';
import type { GrammarTab, Section, WordText } from '../types';
import { en } from './en';
import { zhHans } from './zh-hans';

export interface PageMeta {
    title: string;
    description: string;
}

/** The things a page counts: a catalog writes each count with its noun ("1 word", "3 strokes"). */
export type CountedNoun = 'word' | 'stroke' | 'grammar point' | 'synonym';

/**
 * A catalog's sentence in its own word order: the plain runs, and each marked run's text with its
 * language when it is not the page's (a Japanese word, an order's English name), its href when it
 * is a link, and for a link into the app the placement its click is counted under (lib/appLinks.ts).
 * One type for every such sentence, rendered by pages/LinkedText.svelte.
 */
export type LinkedText = readonly (string | { text: string; lang?: string; href?: string; placement?: DictionaryPlacement })[];

/** What the app panel (pages/AppPanel.svelte) says on a page: one sentence, and its one action. */
export interface PanelCopy {
    text: LinkedText;
    action: string;
}

/** The figures the home page counts. */
export interface SiteCounts {
    words: number;
    kanji: number;
    grammar: number;
    sentences: number;
}

/** A browse tile: its title, the line under it, and what it holds. */
export interface Tile {
    title: string;
    meta: string;
    blurb: string;
}

export interface Messages {
    count: (n: number, noun: CountedNoun) => string;
    /** A kanji range page's heading, also its title. */
    kanjiRangeHeading: (order: KanjiOrder, range: { first: number; last: number }) => string;
    /** A JLPT level as every page names it (a tile, a breadcrumb step, a chip): "JLPT N5". */
    jlptLabel: (level: number) => string;
    /** The level alone, where JLPT is already said (a list of the other levels): "N5". */
    jlptLevel: (level: number) => string;
    /** What every page has around its content. */
    chrome: {
        skipLink: string;
        /** The word after 語感 in the site title. */
        siteTitleWord: string;
        /** The main navigation's accessible name. */
        mainNav: string;
        sections: Record<Section, string>;
        breadcrumb: string;
        /** The breadcrumb's first step, the dictionary home. */
        breadcrumbHome: string;
        /** Breadcrumb steps no section or grammar tab names. */
        crumbs: { kanjiOrders: string; search: string };
        footer: (links: { dataset: string; srs: AppLink }) => LinkedText;
        search: { label: string; placeholder: string; results: string };
        /** The furigana toggle's two states (client/search.ts reads the second from the button). */
        hideFurigana: string;
        showFurigana: string;
        grammarTabs: { label: string } & Record<GrammarTab, string>;
        /**
         * The mark on a link from a page in another language to a page served in English only (a
         * kanji, a grammar point), beside the link's text: the link also carries hreflang="en".
         */
        inEnglish: string;
        /** The language switcher's accessible name. */
        languages: string;
        /** A pager's accessible name. */
        pages: string;
        /** A long word list's disclosure: "All 401 words". */
        allWords: (n: number) => string;
    };
    home: {
        heading: string;
        lede: string;
        browse: string;
        tiles: { vocab: Tile; kanji: (kanjiCount: number) => Tile; kanjiOrders: Tile; grammar: (pointCount: number) => Tile };
        commonWords: string;
        counts: (counts: SiteCounts) => string;
        about: string;
        aboutText: (links: { dataset: string; srs: AppLink }) => LinkedText;
        /** The home page's section on the app, above its panel. */
        appHeading: string;
    };
    /**
     * The app panel's copy per page type: each sentence uses what only Gokan knows about the page
     * (the step of a kanji order at which a word becomes readable), `general` where no order does.
     */
    appPanel: {
        word: (word: string, at: OrderStep) => PanelCopy;
        kanji: (character: string, at: OrderStep, unlocked: number) => PanelCopy;
        /**
         * A range page: knowing the order up to the range's last step. No word count: the page's
         * intro has just given it.
         */
        range: (through: OrderStep) => PanelCopy;
        order: (order: KanjiOrder) => PanelCopy;
        grammar: PanelCopy;
        home: PanelCopy;
        general: PanelCopy;
    };
    vocabIndex: {
        intro: (wordCount: number) => string;
        /** What each JLPT level's words are, by level. */
        levelBlurbs: Readonly<Record<number, string>>;
    };
    vocabJlpt: {
        /** The page's heading; a page after the first says which it is. */
        heading: (level: number, page: number) => string;
        /** The breadcrumb step naming a page after the first (the level's is jlptLabel). */
        pageCrumb: (page: number) => string;
        intro: (wordCount: number) => string;
        /** Which words a page of a split list holds, by rank. */
        range: (first: number, last: number) => string;
        /** The other levels' links (each a jlptLevel): the nav's accessible name, the words before them. */
        otherLevels: string;
        otherLevelsLead: string;
    };
    /** A word page's words. */
    vocab: {
        /** Before the kanji spelling of a word learned in kana. */
        usuallyKana: string;
        /** Before the other readings, and before the other spellings. */
        alsoRead: string;
        alsoWritten: string;
        sections: {
            meanings: string; examples: string; closestSynonyms: string; sentences: string; synonyms: string;
            forms: string; kanji: string; related: string; madeOf: string; usedIn: string;
        };
        /** Below 1024px, the tab row's accessible name and each tab's, in the app's words and order. */
        tabs: { label: string; dict: string; sentences: string; synonyms: string; forms: string; kanji: string; related: string };
        /** Meanings past the first three, in place. */
        showAllMeanings: (n: number) => string;
        rareMeanings: (n: number) => string;
        /** A capped list's disclosure: the rest of what the page ships. */
        showMore: (n: number) => string;
        /** The Synonyms section's meaning groups past the first two. */
        showMoreMeanings: (n: number) => string;
        /** A synonym group's title, before its glosses: "For meaning 1". */
        forMeaning: (n: number) => string;
        /** Under the Synonyms section when the page ships fewer than the word has. */
        synonymsNotListed: (n: number) => string;
        /** A synonym's label, beside its sign (= ≈ ≠): how close it is in the meaning it is listed under. */
        closeness: Record<Closeness, string>;
        /** The header's facts: how common the word is (the band's name and its round top), its textbook lessons. */
        howCommon: { label: string; bands: Record<FrequencyBandName, string>; reference: (top: { top: number; beyond: boolean } | null) => string };
        textbooks: string;
        /** A section's search field's hidden label. */
        search: { sentences: string; synonyms: string; related: string };
        /** The Forms table: its columns, its rows, and every other form's name. */
        forms: { plain: string; polite: string; present: string; negative: string; past: string; pastNegative: string; labels: Record<FormLabel, string> };
        /** Under the Kanji used tiles, on a page in another language: their pages are in English. */
        kanjiInEnglish: string;
        /** A section's credit line, naming the sources of what it shows. */
        credit: (sourceNames: readonly string[]) => string;
        /** English's own sources, credited on a page in another language: its meanings', its sentences'. */
        englishMeaningsSource: string;
        sentencesSource: string;
    };
    /** The dataset's text sources by id (SourceRef.source), as a credit line names them. */
    sources: Readonly<Partial<Record<string, string>>>;
    /**
     * A word page's Meanings in another language, one label per group: its own sources' definitions,
     * its equivalents, then English's meanings.
     */
    meaningGroups: { definitions: string; equivalents: string; english: string };
    /** A page that could not be shown: 404, or any other status. */
    /** The search results page, before its script has found anything (client/search.ts writes the rest). */
    searchPage: {
        heading: string;
        /** Without JavaScript: where to browse instead. */
        noScript: (links: { vocab: string; kanji: string; grammar: string }) => LinkedText;
    };
    error: {
        heading: (status: number) => string;
        explanation: (status: number) => string;
        browse: (links: { vocab: string; kanji: string; grammar: string; home: string }) => LinkedText;
    };
    /** Each page type's title and description. */
    meta: {
        home: () => PageMeta;
        search: () => PageMeta;
        error: (status: number) => PageMeta;
        /** A word page; on a page in another language, `text` is the word's text in it. */
        vocab: (vocab: Vocabulary, text?: WordText) => PageMeta;
        kanji: (kanji: Kanji, vocabCount: number) => PageMeta;
        grammar: (point: GrammarPoint) => PageMeta;
        vocabIndex: (vocabCount: number) => PageMeta;
        /** A JLPT list page; pages after the first say which page they are, so their titles stay distinct. */
        vocabJlpt: (level: number, wordCount: number, page?: number) => PageMeta;
        kanjiIndex: (kanjiCount: number) => PageMeta;
        kanjiOrders: (orders: readonly KanjiOrder[]) => PageMeta;
        kanjiOrder: (order: KanjiOrder, kanjiCount: number, wordCount: number) => PageMeta;
        kanjiRange: (order: KanjiOrder, range: { first: number; last: number }, wordCount: number) => PageMeta;
        grammarIndex: (pointCount: number) => PageMeta;
        grammarFamiliesIndex: (familyCount: number) => PageMeta;
        grammarFamily: (familyName: string, memberCount: number) => PageMeta;
        grammarChaptersIndex: (chapterCount: number, pointCount: number) => PageMeta;
        grammarChapter: (chapter: GrammarChapter) => PageMeta;
        grammarConjugationsIndex: (formCount: number, pointCount: number) => PageMeta;
    };
}

/**
 * Every locale's catalog: a locale without one is a type error, so any locale the build is told to
 * serve (VITE_DICTIONARY_LOCALES) has one.
 */
const CATALOG: Record<ServedLocale, Messages> = { en, 'zh-hans': zhHans };

export function messagesFor(locale: ServedLocale): Messages {
    return CATALOG[locale];
}

/**
 * Every fixed string of a catalog (its functions' output aside): what the rendered-page checks look
 * for (documentShell.ts), English's on a page in another language, a locale's own outside its lang.
 */
export function catalogStrings(messages: Messages): string[] {
    const found = new Set<string>();
    const visit = (value: unknown): void => {
        if (typeof value === 'string') found.add(value.trim());
        else if (value !== null && typeof value === 'object') for (const child of Object.values(value)) visit(child);
    };
    visit(messages);
    found.delete('');
    return [...found];
}
