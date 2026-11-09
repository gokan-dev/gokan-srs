// A language's text layer (text/<language>/ in the compiled dataset), as the dictionary's pages in
// that language read it: LocaleText (lib/types.ts), over the reads either source makes (the
// checkout's files, the published dataset over HTTP). The one place renderings are filtered: only
// those the dataset's acceptance rule shows (`isShown`) leave here, so no page model can carry a
// rejected text, or one too unreliable to show alone.

import type { Sentence } from '@gokan/dataset-schema';
import {
    definitionsOf, equivalentsOf, isShown, translationRenderingsOf, valueText,
    type EntityText, type TextEntitiesIndex, type TextFile, type Translation,
} from '@gokan/dataset-schema/text';
import { DATASET_PATHS } from '../datasetPaths';
import type { DatasetLanguage } from '../locale';
import type { LocaleText, SentenceTranslation, WordText } from '../types';
import { kept } from './kept';

/** What a source reads of a language's text layer: files as published (unprojected), at their path under compiled/. */
export interface TextReads {
    /** Its text index (DATASET_PATHS.textEntities). */
    index(path: string): Promise<TextEntitiesIndex>;
    /** One of its text files. */
    file(path: string): Promise<TextFile>;
}

/** An entity's text with only the renderings `isShown` accepts, in the shape the accessors read. */
function shown(language: string, text: EntityText | undefined) {
    return { [language]: { renderings: (text?.renderings ?? []).filter(isShown) } };
}

export function localeText(language: Exclude<DatasetLanguage, 'en'>, reads: TextReads): LocaleText {
    const index = kept(async () => {
        const entities = await reads.index(DATASET_PATHS.textEntities(language));
        return { vocab: new Set(entities.vocab ?? []), sentences: new Set(entities.sentences ?? []), vocabOrder: entities.vocab ?? [] };
    });
    const textFile = (corePath: string) => reads.file(DATASET_PATHS.text(language, corePath));

    async function wordText(id: string): Promise<WordText | null> {
        // A word the index does not list has no text in the language: no request for its file.
        if (!(await index()).vocab.has(id)) return null;
        const text = shown(language, (await textFile(DATASET_PATHS.vocab(id))).entities[id]);
        const word = { definitions: definitionsOf(text, language), equivalents: equivalentsOf(text, language) };
        return word.definitions.length > 0 || word.equivalents.length > 0 ? word : null;
    }

    return {
        language,
        wordText,
        wordIds: async () => {
            const ids: string[] = [];
            for (const id of (await index()).vocabOrder) if (await wordText(id)) ids.push(id);
            return ids;
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
