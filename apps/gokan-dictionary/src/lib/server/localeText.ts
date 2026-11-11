// A language's text layer (text/<language>/ in the compiled dataset), as the dictionary's pages in
// that language read it: LocaleText (lib/types.ts), over the reads either source makes (the
// checkout's files, the published dataset over HTTP). The one place renderings are filtered: only
// those the dataset's acceptance rule shows (`isShown`) leave here, so no page model can carry a
// rejected text, or one too unreliable to show alone.

import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
import {
    definitionsOf, equivalentsOf, isShown, translationRenderingsOf, valueText,
    type Definition, type DefinitionSense, type EntityText, type Equivalent, type TextEntitiesIndex, type TextFile, type TextSearchGlosses, type Translation,
} from '@gokan/dataset-schema/text';
import { DATASET_PATHS } from '../datasetPaths';
import { shortWordTextSummary, wordTextSummary } from '../senses';
import type { DatasetLanguage } from '../locale';
import type { LocaleText, SentenceTranslation, WordEquivalent, WordText } from '../types';
import { kept, keptBy } from './kept';

/** What a source reads of a language's text layer: files as published (unprojected), at their path under compiled/. */
export interface TextReads {
    /** Its text index (DATASET_PATHS.textEntities). */
    index(path: string): Promise<TextEntitiesIndex>;
    /** One of its text files. */
    file(path: string): Promise<TextFile>;
    /** Its search glosses (DATASET_PATHS.textSearchGlosses), read at build only, for the search index. */
    glosses(path: string): Promise<TextSearchGlosses>;
    /** A word's core file (its spellings and readings), read only for a word with a sense restricted to some of its forms. */
    vocab(id: string): Promise<WordForms>;
}

/** What of a word says which spellings and readings are its own. */
export type WordForms = Pick<Vocabulary, 'writtenForm' | 'reading' | 'mergedVocabs'>;

/** Every spelling and reading of a word: its kanji forms, its readings, its merged homographs' readings. */
function formsOf(vocab: WordForms): Set<string> {
    return new Set([
        vocab.writtenForm.kanji, ...vocab.writtenForm.alternatives, vocab.reading.primary, ...vocab.reading.alternatives,
        ...(vocab.mergedVocabs ?? []).map(merged => merged.originalPrimaryReading),
    ].filter(form => form !== ''));
}

/** A sense that names the spellings or readings it applies to, any list of them (Chinese Wiktionary's homophone senses). */
const isRestricted = (sense: DefinitionSense): boolean =>
    (sense.appliesToSpellings?.length ?? 0) > 0 || (sense.appliesToReadings?.length ?? 0) > 0;

/**
 * A word's definitions without the senses written for another word. Chinese Wiktionary's する page
 * also defines its homophones (刷る、摺る: 印刷), each sense naming the spellings it is for: one
 * whose list (of spellings, or of readings) names none of this word's forms is not a meaning of
 * this word, and a definition left without senses is dropped.
 */
export function ownSenses(definitions: readonly Definition[], forms: ReadonlySet<string>): Definition[] {
    const names = (list: readonly string[] | undefined) => list === undefined || list.length === 0 || list.some(form => forms.has(form));
    return definitions
        .map(definition => ({ ...definition, senses: definition.senses.filter(sense => names(sense.appliesToSpellings) && names(sense.appliesToReadings)) }))
        .filter(definition => definition.senses.length > 0);
}

/** An entity's text with only the renderings `isShown` accepts, in the shape the accessors read. */
function shown(language: string, text: EntityText | undefined) {
    return { [language]: { renderings: (text?.renderings ?? []).filter(isShown) } };
}

/**
 * A word's equivalents as a page lists them: each text once, in the order it first appears, with
 * every source that gives it. Two renderings can read the same (one written in simplified script,
 * one converted from traditional, 聪明 and 聰明 -> 聪明), and a reader is shown the word once.
 */
export function distinctEquivalents(equivalents: readonly Equivalent[]): WordEquivalent[] {
    const byText = new Map<string, WordEquivalent>();
    for (const equivalent of equivalents) {
        const text = valueText(equivalent.value);
        const found = byText.get(text);
        if (!found) byText.set(text, { text, sources: [equivalent.source] });
        else if (!found.sources.some(known => known.source === equivalent.source.source && known.ref === equivalent.source.ref)) found.sources.push(equivalent.source);
    }
    return [...byText.values()];
}

/**
 * Whether a search gloss is made of a word's shown text (WordText, filtered here): the whole of one
 * of its shown definitions' glosses, or each of its parts (the dataset joins equivalents with "，")
 * one of its shown equivalents. The dataset writes its search glosses from shown renderings only,
 * but a page drops some of those (another word's senses, ownSenses), and a search row never says
 * what the word's page does not.
 */
export function glossIsShown(gloss: string, word: WordText): boolean {
    const glosses = new Set(word.definitions.flatMap(definition => definition.senses.flatMap(sense => sense.glosses.map(valueText))));
    const equivalents = new Set(word.equivalents.map(equivalent => equivalent.text));
    return glosses.has(gloss) || gloss.split('，').every(part => equivalents.has(part));
}

export function localeText(language: Exclude<DatasetLanguage, 'en'>, reads: TextReads): LocaleText {
    const index = kept(async () => {
        const entities = await reads.index(DATASET_PATHS.textEntities(language));
        return { vocab: new Set(entities.vocab ?? []), sentences: new Set(entities.sentences ?? []), vocabOrder: entities.vocab ?? [] };
    });
    const textFile = (corePath: string) => reads.file(DATASET_PATHS.text(language, corePath));

    // Kept per word: the catalog (wordIds) reads every listed word, and its page then reads it again.
    const wordText = keptBy(async (id: string): Promise<WordText | null> => {
        // A word the index does not list has no text in the language: no request for its file.
        if (!(await index()).vocab.has(id)) return null;
        const text = shown(language, (await textFile(DATASET_PATHS.vocab(id))).entities[id]);
        const definitions = definitionsOf(text, language);
        // Before the test below, so a word whose only senses are another word's has no page.
        const restricted = definitions.some(definition => definition.senses.some(isRestricted));
        const word = {
            definitions: restricted ? ownSenses(definitions, formsOf(await reads.vocab(id))) : definitions,
            equivalents: distinctEquivalents(equivalentsOf(text, language)),
        };
        return word.definitions.length > 0 || word.equivalents.length > 0 ? word : null;
    });

    const withPages = async (ids: readonly string[]): Promise<string[]> => {
        const texts = await Promise.all(ids.map(wordText));
        return ids.filter((_, at) => texts[at] !== null);
    };

    const wordIds = kept(async () => withPages((await index()).vocabOrder));

    const wordSummary = keptBy(async (id: string): Promise<string | null> => {
        const text = await wordText(id);
        return text === null ? null : shortWordTextSummary(text);
    });

    const searchGlosses = kept(async () => reads.glosses(DATASET_PATHS.textSearchGlosses(language)));
    const searchGloss = async (id: string): Promise<string | null> => {
        const text = await wordText(id);
        if (text === null) return null;
        const listed = (await searchGlosses())[id];
        return listed !== undefined && glossIsShown(listed, text) ? listed : wordTextSummary(text);
    };

    return {
        language,
        wordText,
        searchGloss,
        withPages,
        wordIds,
        wordSummary,
        firstWordId: async () => {
            for (const id of (await index()).vocabOrder) if (await wordText(id)) return id;
            return null;
        },
        sentenceTranslations: async vocabId => {
            const translations = new Map<string, Translation>();
            if (!(await index()).sentences.has(vocabId)) return translations;
            for (const [sentenceId, text] of Object.entries((await textFile(DATASET_PATHS.sentences(vocabId))).entities)) {
                const [first] = translationRenderingsOf(shown(language, text), language);
                if (first) translations.set(sentenceId, first);
            }
            return translations;
        },
    };
}

/**
 * Each sentence's translation on a page in `language`, by sentence id: the language's own (from
 * `translations`, LocaleText's), else its English, marked as English. A sentence with neither has
 * none.
 */
export function sentenceTranslationsOf(
    sentences: readonly Sentence[],
    translations: ReadonlyMap<string, Translation>,
    language: Exclude<DatasetLanguage, 'en'>,
): Record<string, SentenceTranslation> {
    const byId: Record<string, SentenceTranslation> = {};
    for (const sentence of sentences) {
        const own = translations.get(sentence.id);
        const english = sentence.en.at(0);
        if (own) byId[sentence.id] = { lang: language, text: valueText(own.value), source: own.source };
        else if (english) byId[sentence.id] = { lang: 'en', text: english.text };
    }
    return byId;
}
