// Lightweight cross-page view types, the dictionary's own search index format, and EntityData and
// DictionaryData, what the pages read of the dataset. lib/server/pages.ts resolves summaries once per referenced
// id and passes them down as props, so a page linking to another entry never embeds that entry's
// full dataset object.

import type {
    FrequencyIndex, GrammarConjugationIndex, GrammarContrastIndex, GrammarExample, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex,
    JlptIndex, Kanji, KanjiOrderId, KanjiOrderList, KanjiVocabIndex, Sentence, Vocabulary,
} from '@gokan/dataset-schema';
import type { Definition, Equivalent, SourceRef, Translation } from '@gokan/dataset-schema/text';
import type { DatasetLanguage } from './locale';

/** The site section a page belongs to, marked current in the header nav. */
export type Section = 'vocab' | 'kanji' | 'grammar';

/** The grammar browse pages' tabs (pages/GrammarTabs.svelte). */
export type GrammarTab = 'level' | 'families' | 'curriculum' | 'conjugations';

export interface VocabSummary {
    id: string;
    /** The headword (headwordOf): the kanji spelling, or the kana for a word learned in kana. */
    word: string;
    /**
     * The kana reading, only when it differs from the headword. Never a word learned in kana's
     * rare kanji spelling: that appears only on the word's own page.
     */
    reading?: string;
    /** The first sense's glosses, cut short (shortGloss). */
    gloss?: string;
}

/**
 * The GrammarPoint equivalent, used for a page's family/related-points list. Kept to the fields a
 * row needs so a family of 6 points doesn't pull 6 full points (with all their examples) into
 * one page's props.
 */
export interface GrammarSummary {
    id: string;
    title: string;
    jlptLevel: number;
    romaji?: string;
    /** The short explanation, cut short for a list row. */
    shortExplanation?: string;
}

/**
 * One word of the search index, as a compact array (it is downloaded, ~36k times over):
 * id, headword (searchHeadword), secondary form (the reading, or a word learned in kana's kanji
 * spelling), the short gloss, JLPT level (0 for none) and flags (searchFlags in searchIndex.ts:
 * common, learned in kana, conjugation class). Rows are in frequency order, so a row's position
 * is its frequency rank.
 */
export type SearchWordRow = [id: string, headword: string, secondary: string, gloss: string, jlpt: number, flags: number];

/** One kanji: the character, JLPT level (0 for none) and frequency rank (0 for none). */
export type SearchKanjiRow = [character: string, jlpt: number, frequency: number];

/** One grammar point, in teaching order: id, title, romaji ('' for none), short explanation, JLPT level. */
export type SearchGrammarRow = [id: string, title: string, romaji: string, explanation: string, jlpt: number];

/**
 * The words of an index file, one array per field (id, headword, secondary form, gloss, JLPT
 * level, flags), position i of each describing word i. Column by column compresses far better
 * than row by row: the core file is 292 KB gzipped this way, 379 KB as one array per word.
 */
export type SearchWordColumns = [ids: string[], headwords: string[], secondary: string[], glosses: string[], jlpt: number[], flags: number[]];

/**
 * A search index file. `search-core.json` carries every JLPT word, the most frequent words, every
 * kanji and every grammar point; `search-full.json` only the remaining words. Read after the core,
 * the full file's rows rank after it, which is their place anyway: each is rarer than every
 * non-JLPT core word, and JLPT words rank first whatever their frequency.
 */
export interface SearchIndexFile {
    w: SearchWordColumns;
    k?: SearchKanjiRow[];
    g?: SearchGrammarRow[];
    /**
     * The dataset version the index was built from, written into both files by their routes
     * (stampedSearchIndex). A page rendered on request lists entries from these rows, so the server
     * refuses an index of another version (httpData) rather than render a page with entries missing.
     */
    datasetVersion?: string;
}

/**
 * A word's text in a language other than English, as its page in that language shows it: every
 * rendering in it is one `isShown` accepts (lib/server/localeText.ts is the one place that
 * filters). Each rendering keeps its source, for the page's credit line.
 */
export interface WordText {
    /** Each source's own definition (Chinese Wiktionary's), its senses as that source wrote them. */
    definitions: Definition[];
    /** The word's equivalents in the language, each from its source. */
    equivalents: Equivalent[];
}

/**
 * An example sentence's translation on a page in another language: the language's own, from its
 * source, else the sentence's English, marked as English so the sentence stays understandable
 * (decided in #170).
 */
export type SentenceTranslation =
    | { lang: 'en'; text: string }
    | { lang: Exclude<DatasetLanguage, 'en'>; text: string; source: SourceRef };

/**
 * What a page in a language other than English reads of the dataset's text layer
 * (`text/<language>/`), over either source: only renderings `isShown` accepts ever leave it.
 */
export interface LocaleText {
    language: Exclude<DatasetLanguage, 'en'>;
    /**
     * A word's text in the language, or null when none of it is shown. The one answer to whether a
     * word has a page in the language: it has one exactly when this is not null (the others have
     * none, decided in #170).
     */
    wordText(id: string): Promise<WordText | null>;
    /** Every word with a page in the language, in the text index's order: read at build, for the catalog. */
    wordIds(): Promise<string[]>;
    /** A word's example sentences' translations in the language, shown ones only, by sentence id. */
    sentenceTranslations(vocabId: string): Promise<ReadonlyMap<string, Translation>>;
}

/**
 * What an entity page (a word, a kanji, a grammar point) reads of the dataset, asked per entity or
 * per index: its own entity's files and the indexes it lists other entries from. A page rendered
 * on request has this and no more: `httpData` (lib/server/httpData.ts), over the published
 * dataset; the checkout (`checkoutData`) provides it too, as part of DictionaryData. Asynchronous
 * for that reason. Every value is in the English shape the `@gokan/dataset-schema` types describe;
 * a source in another language adds that language's text beside them (`localeText`).
 */
export interface EntityData {
    vocab(id: string): Promise<Vocabulary>;
    /** A word's example sentences, or null when it has none (the common case for a rare word). */
    sentencesFor(vocabId: string): Promise<Sentence[] | null>;
    /**
     * Every word as other pages list it (a kanji's words, a JLPT list, related words), by id: one
     * index, so a page that lists 600 words reads one file rather than 600 (on request, the search
     * index the build writes). Its keys are every word: a word page exists exactly for them.
     */
    wordSummaries(): Promise<ReadonlyMap<string, VocabSummary>>;
    /** Every grammar point as a list row shows it, by id: its keys are every point (as wordSummaries). */
    grammarSummaries(): Promise<ReadonlyMap<string, GrammarSummary>>;
    kanjiList(): Promise<Kanji[]>;
    /** Kanji -> the words that contain it, most frequent first. */
    kanjiVocabIndex(): Promise<KanjiVocabIndex>;
    /** One kanji learning order's kanji, in teaching order: step N is the Nth. */
    kanjiOrder(order: KanjiOrderId): Promise<KanjiOrderList>;
    grammarPoint(id: string): Promise<GrammarPoint>;
    /** The authored introduction order: chapters, and the points in the order they are taught. */
    grammarTeachingOrder(): Promise<GrammarTeachingOrder>;
    /** Canonical point id -> its realization variants. */
    grammarVariantGroups(): Promise<GrammarVariantGroupIndex>;
    /** Point id -> its conjugation drill, for the inflection points. */
    grammarConjugations(): Promise<GrammarConjugationIndex>;
    /** A point's corpus-mined examples, or null for a point with none (most of them). */
    grammarMinedExamples(id: string): Promise<GrammarExample[] | null>;
    /** The text layer in the source's language, or null for English, whose text the values above already carry. */
    localeText: LocaleText | null;
}

/**
 * What the whole site is built from: EntityData, and the catalogs only list pages and the search
 * index read (every id, the JLPT and frequency orders, the grammar families). The one source of it
 * is the checkout, through the English view (`checkoutData` in dataset.server.ts), at build: the
 * list pages are prerendered. A source in another language reads the same, plus its text.
 */
export interface DictionaryData extends EntityData {
    /** Every word's id, in the order the vocab directory lists them. */
    vocabIds(): Promise<string[]>;
    /** JLPT level -> that level's words, frequency-ordered. */
    vocabJlptIndex(): Promise<JlptIndex>;
    /** Every word, most frequent first: the order of the search index. */
    frequencyIndex(): Promise<FrequencyIndex>;
    /** Every grammar point id, easiest first (N5 to N1), the SRS's own order. */
    grammarIds(): Promise<string[]>;
    /** Family id -> its contrast lessons and interchangeable note. */
    grammarContrasts(): Promise<GrammarContrastIndex>;
}
