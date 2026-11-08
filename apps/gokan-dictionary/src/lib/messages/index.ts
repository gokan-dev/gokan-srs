// What the dictionary says, per locale: one typed module per locale (./en.ts), every one held to
// `Messages`, so a catalog missing a key, or a served locale with no catalog, does not build. No
// runtime i18n library: a page reads its catalog as plain values and functions (its locale's,
// from pages/pageLocale.ts, set by the root layout, or messagesFor on the server).
//
// Text the dataset holds (meanings, explanations, examples) is the dataset's, read in the
// locale's language (lib/locale.ts, datasetLanguageOf); this is everything else.

import type { GrammarChapter, GrammarPoint, Kanji, KanjiOrder, Vocabulary } from '@gokan/dataset-schema';
import type { ServedLocale } from '../locale';
import type { GrammarTab, Section } from '../types';
import { en } from './en';

export interface PageMeta {
    title: string;
    description: string;
}

/** The things a page counts: a catalog writes each count with its noun ("1 word", "3 strokes"). */
export type CountedNoun = 'word' | 'stroke' | 'grammar point';

/** Text with links in it, in the catalog's word order: the plain runs, and each link's text and href. */
export type LinkedText = readonly (string | { text: string; href: string })[];

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
        footer: (links: { dataset: string; srs: string }) => LinkedText;
        search: { label: string; placeholder: string; results: string };
        hideFurigana: string;
        grammarTabs: { label: string } & Record<GrammarTab, string>;
    };
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
        vocab: (vocab: Vocabulary) => PageMeta;
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

/** Every served locale's catalog: serving a locale without one is a type error. */
const CATALOG: Record<ServedLocale, Messages> = { en };

export function messagesFor(locale: ServedLocale): Messages {
    return CATALOG[locale];
}
