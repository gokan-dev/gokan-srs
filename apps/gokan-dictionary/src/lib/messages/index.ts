// What the dictionary says, per locale: one typed module per locale (./en.ts), every one held to
// `Messages`, so a catalog missing a key, or a served locale with no catalog, does not build. No
// runtime i18n library: a page reads its catalog as plain values and functions (its locale's,
// from pages/pageLocale.ts, set by the root layout, or messagesFor on the server).
//
// Text the dataset holds (meanings, explanations, examples) is the dataset's, read in the
// locale's language (lib/locale.ts, datasetLanguageOf); this is everything else.

import type { GrammarChapter, GrammarPoint, Kanji, KanjiOrder, Vocabulary } from '@gokan/dataset-schema';
import type { FormLabel } from '../conjugation';
import type { ServedLocale } from '../locale';
import type { GrammarTab, Section, WordText } from '../types';
import { en } from './en';
import { zhHans } from './zh-hans';

export interface PageMeta {
    title: string;
    description: string;
}

/** The things a page counts: a catalog writes each count with its noun ("1 word", "3 strokes"). */
export type CountedNoun = 'word' | 'stroke' | 'grammar point';

/** Text with links in it, in the catalog's word order: the plain runs, and each link's text and href. */
export type LinkedText = readonly (string | { text: string; href: string })[];

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
        footer: (links: { dataset: string; srs: string }) => LinkedText;
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
        aboutText: (links: { dataset: string; srs: string }) => LinkedText;
    };
    vocabIndex: {
        intro: (wordCount: number) => string;
        levelTitle: (level: number) => string;
        /** What each JLPT level's words are, by level. */
        levelBlurbs: Readonly<Record<number, string>>;
    };
    vocabJlpt: {
        /** The page's heading; a page after the first says which it is. */
        heading: (level: number, page: number) => string;
        /** The breadcrumb step naming the level, and the one naming a page after the first. */
        levelCrumb: (level: number) => string;
        pageCrumb: (page: number) => string;
        intro: (wordCount: number) => string;
        /** Which words a page of a split list holds, by rank. */
        range: (first: number, last: number) => string;
        /** The other levels' links: the nav's accessible name, the words before them, each link. */
        otherLevels: string;
        otherLevelsLead: string;
        levelLink: (level: number) => string;
    };
    /** A word page's words. */
    vocab: {
        /** Before the kanji spelling of a word learned in kana. */
        usuallyKana: string;
        /** Before the other readings, and before the other spellings. */
        alsoRead: string;
        alsoWritten: string;
        commonWord: string;
        sections: { meanings: string; forms: string; sentences: string; kanji: string; madeOf: string; usedIn: string };
        allMeanings: (n: number) => string;
        rareMeanings: (n: number) => string;
        moreExamples: (n: number) => string;
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
    sources: Readonly<Record<string, string>>;
    /**
     * A word page's Meanings in another language, one label per group: its own sources' definitions,
     * its equivalents, then English's meanings.
     */
    meaningGroups: { definitions: string; equivalents: string; english: string };
    /** A page that could not be shown: 404, or any other status. */
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
