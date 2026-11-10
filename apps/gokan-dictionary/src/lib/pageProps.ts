// The props of each page component (src/pages/*Page.svelte): the contract between the page's
// builder (lib/server/pages.ts) and the component it renders. In TypeScript rather than in each
// component, so the builders are typed by them: a .svelte import reaches a .ts file's linting as
// an untyped module.

import type { GrammarConjugationIndex, GrammarExample, GrammarPoint, Kanji, KanjiOrder, KanjiOrderId, Sentence, Vocabulary } from '@gokan/dataset-schema';
import type { ConjugationTable } from './grammarConjugations';
import type { ChapterIndexRow, ChapterLocator } from './grammarChapters';
import type { FamilyPageData } from './grammarFamilies';
import type { LevelGroup } from './grammarBrowse';
import type { VariantSibling } from './grammarVariants';
import type { KanjiRange, StepRange } from './kanjiOrders';
import type { GrammarSummary, SentenceTranslation, VocabSummary, WordText } from './types';

/** HomePage.svelte */
export interface HomePageProps {
  vocabCount: number;
  kanjiCount: number;
  grammarCount: number;
  sentenceCount: number;
  /** The most frequent N5 words, as a concrete entry point. */
  featured: VocabSummary[];
}

/** VocabPage.svelte */
export interface VocabPageProps {
  vocab: Vocabulary;
  components: VocabSummary[];
  parents: VocabSummary[];
  /** Already ordered and capped (lib/sentenceOrder.ts). */
  sentences: Sentence[];
  /** On a page in another language: the word's text in it (shown renderings only). English's page has none. */
  text?: WordText;
  /** On a page in another language: each sentence's translation, by sentence id. */
  translations?: Record<string, SentenceTranslation>;
  /** On a page in another language: the words it links that have a page in it (the rest link to English's, lib/localeLinks.ts). */
  wordsInLocale?: string[];
  /**
   * On a page in another language: the words its sentences name and the kanji it is written with
   * that have no page in any language, shown without a link. English's page still links them (a
   * 404), left to a change of its own.
   */
  withoutPage?: { words: string[]; kanji: string[] };
}

/** VocabIndexPage.svelte */
export interface VocabIndexPageProps {
  levels: { level: number; count: number }[];
  totalCount: number;
}

/** VocabJlptPage.svelte */
export interface VocabJlptPageProps {
  level: number;
  /** This page's words, in frequency order. */
  words: VocabSummary[];
  /** The level's word count across every page. */
  total: number;
  page: number;
  pageCount: number;
  /** 1-based rank of this page's first word. */
  firstRank: number;
  /** Every level, for the cross-links at the foot of the page. */
  allLevels: number[];
}

/** KanjiPage.svelte */
export interface KanjiPageProps {
  kanji: Kanji;
  /** Every word containing the kanji, most frequent first. */
  words: VocabSummary[];
  /** Every kanji with a page, so a component that is one (子 in 学) links to it. */
  kanjiWithPages: ReadonlySet<string>;
  /** Each learning order's length: a book position links to its range page when the book is an order. */
  orderLengths: ReadonlyMap<KanjiOrderId, number>;
}

/** KanjiIndexPage.svelte */
export interface KanjiIndexPageProps {
  /** Groups in presentation order (N5 first); `level` is null for kanji outside the JLPT lists. */
  groups: { level: number | null; kanji: Kanji[] }[];
}

/** KanjiOrdersPage.svelte */
export interface KanjiOrdersPageProps {
  /** Every order, the most followed first (KANJI_ORDERS), with what it covers. */
  orders: { order: KanjiOrder; kanjiCount: number; wordCount: number }[];
}

/** KanjiOrderPage.svelte */
export interface KanjiOrderPageProps {
  order: KanjiOrder;
  ranges: KanjiRange[];
  kanjiCount: number;
  wordCount: number;
}

/** KanjiRangePage.svelte */
export interface KanjiRangePageProps {
  order: KanjiOrder;
  range: StepRange;
  /** Each step of the range: its kanji, the head of the words it unlocks, and how many it unlocks. */
  steps: { step: number; character: string; words: VocabSummary[]; total: number }[];
  /** Every word the range unlocks, listed or not. */
  wordCount: number;
  /** Every range of the order, for the pager. */
  ranges: StepRange[];
}

/** GrammarPage.svelte */
export interface GrammarPageProps {
  point: GrammarPoint;
  related: GrammarSummary[];
  /** Where this point sits in the teaching order; null when it isn't in it (a non-canonical variant). */
  chapterLocator: ChapterLocator | null;
  /** This point's realization variants, e.g. それでは/それじゃ/じゃ; [] when it has none. */
  variants: VariantSibling[];
  /** This point's conjugation drill table, for `kind: 'inflection'` points that have one. */
  conjugation: GrammarConjugationIndex[string] | null;
  /** Capped corpus-mined sentence pool; [] when the point has none. */
  minedExamples: GrammarExample[];
  /** The pool's true size before the cap. */
  minedExamplesTotalCount: number;
}

/** GrammarIndexPage.svelte */
export interface GrammarIndexPageProps {
  /** Every point, grouped N5 first, in teaching order within a level. */
  groups: LevelGroup<GrammarSummary>[];
  total: number;
}

/** GrammarFamiliesIndexPage.svelte */
export interface GrammarFamiliesIndexPageProps {
  /** Largest first: the clusters a learner most needs told apart. */
  families: FamilyPageData[];
}

/** GrammarFamilyPage.svelte */
export interface GrammarFamilyPageProps {
  family: FamilyPageData;
}

/** GrammarChaptersIndexPage.svelte */
export interface GrammarChaptersIndexPageProps {
  /** Every chapter in teaching order, grouped under the level of its place in the curriculum. */
  groups: LevelGroup<ChapterIndexRow>[];
  chapterCount: number;
}

/** GrammarChapterPage.svelte */
export interface GrammarChapterPageProps {
  chapter: ChapterIndexRow;
  totalChapters: number;
  /** Adjacent chapters in teaching order, for prev/next navigation. Null at either end. */
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

/** GrammarConjugationsIndexPage.svelte */
export interface GrammarConjugationsIndexPageProps {
  tables: ConjugationTable[];
  formCount: number;
}

/** ErrorPage.svelte */
export interface ErrorPageProps {
    /** The response's status: 404 for no such page, anything else for a failure. */
    status: number;
}
