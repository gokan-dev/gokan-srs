import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { Definition, DefinitionSense, Equivalent, Rendering, TextEntitiesIndex, TextFile, TextSearchGlosses, Value } from '@gokan/dataset-schema/text';
import { sentence } from '../../test/fixtures';
import { checkoutData } from '../dataset.server';
import { DATASET_PATHS } from '../datasetPaths';
import { glossIsShown, localeText, sentenceTranslationsOf, type WordForms } from './localeText';
import { pagesOf } from './pages';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'compiled');

const equivalent = (id: string, status: Rendering['status'], source = 'jawiktionary', value: Value = id): Equivalent => (
    { id, role: 'equivalent', source: { source }, match: 'spelling+reading', status, value }
);

const definition = (id: string, senses: DefinitionSense[]): Definition => (
    { id, role: 'definition', source: { source: 'zhwiktionary' }, match: 'spelling+reading', status: 'imported', senses }
);

const forms = (kanji: string, reading: string): WordForms => ({ writtenForm: { kanji, alternatives: [], containedKanji: [] }, reading: { primary: reading, alternatives: [] } });

/**
 * A language's text layer in memory: each word's renderings, its index listing every word given,
 * the forms of those in `vocab`, and its search glosses.
 */
function memoryReads(words: Record<string, Rendering[]>, vocab: Record<string, WordForms> = {}, glosses: TextSearchGlosses = {}) {
    const files = new Map(Object.entries(words).map(([id, renderings]): [string, TextFile] => [
        DATASET_PATHS.text('zh-hans', DATASET_PATHS.vocab(id)),
        { kind: 'vocab', lang: 'zh-hans', entities: { [id]: { renderings } } },
    ]));
    return {
        index: vi.fn((_path: string): Promise<TextEntitiesIndex> => Promise.resolve({ vocab: Object.keys(words), sentences: [] })),
        file: vi.fn((filePath: string): Promise<TextFile> => {
            const found = files.get(filePath);
            return found ? Promise.resolve(found) : Promise.reject(new Error(`no ${filePath}`));
        }),
        glosses: vi.fn((_path: string): Promise<TextSearchGlosses> => Promise.resolve(glosses)),
        vocab: vi.fn((id: string): Promise<WordForms> => {
            const found = vocab[id];
            return found ? Promise.resolve(found) : Promise.reject(new Error(`no vocab ${id}`));
        }),
    };
}

describe('localeText', () => {
    it('lets out only the renderings isShown accepts (fixtures: a rejected, an unshown and two shown texts)', async () => {
        const text = checkoutData(FIXTURES, 'zh-hans').localeText;
        if (text === null) throw new Error('a zh-hans checkout reads its text layer');
        const word = await text.wordText('1589350');
        expect(word?.definitions.map(definition => definition.id)).toEqual(['def-shown']);
        expect(word?.equivalents.map(shown => shown.text)).toEqual(['想']);
        expect([...(await text.sentenceTranslations('1589350')).values()].map(translation => translation.id)).toEqual(['tr-shown']);
    });

    it('gives a word without any shown text no text, so no page, and lists only the others', async () => {
        const reads = memoryReads({
            shown: [equivalent('a', 'rejected'), equivalent('b', 'corroborated')],
            hidden: [equivalent('c', 'rejected'), equivalent('d', 'imported', 'wikidata')],
        });
        const text = localeText('zh-hans', reads);
        expect(await text.wordText('hidden')).toBeNull();
        expect((await text.wordText('shown'))?.equivalents.map(shown => shown.text)).toEqual(['b']);
        expect(await text.wordIds()).toEqual(['shown']);
        expect(await text.firstWordId()).toBe('shown');
    });

    it('lists an equivalent once when two renderings read the same, with both sources', async () => {
        const fromTraditional = (id: string, source: string): Equivalent => equivalent(id, 'corroborated', source, { value: '聪明', derivedFrom: { value: '聰明', lang: 'zh-hant', transform: 'script:hant-to-hans' } });
        // jawiktionary gives 聪明 twice (written so, and converted): it is named once.
        const text = localeText('zh-hans', memoryReads({
            word: [equivalent('a', 'corroborated', 'jawiktionary', '聪明'), fromTraditional('b', 'jawiktionary'), fromTraditional('c', 'zhwiktionary'), equivalent('智慧', 'reviewed')],
        }));
        expect((await text.wordText('word'))?.equivalents).toEqual([
            { text: '聪明', sources: [{ source: 'jawiktionary' }, { source: 'zhwiktionary' }] },
            { text: '智慧', sources: [{ source: 'jawiktionary' }] },
        ]);
    });

    it('drops a sense written for another spelling of the reading, and a word left with none has no page', async () => {
        const reads = memoryReads({
            1157170: [definition('suru', [
                { glosses: ['做'], appliesToReadings: ['する'] },
                { glosses: ['存在'] },
                { glosses: ['印刷'], appliesToSpellings: ['刷る', '摺る'] },
            ])],
            other: [definition('soru', [{ glosses: ['剃'], appliesToSpellings: ['剃る'] }])],
            plain: [definition('plain', [{ glosses: ['想'] }])],
        }, { 1157170: forms('為る', 'する'), other: forms('為る', 'する') });
        const text = localeText('zh-hans', reads);
        expect((await text.wordText('1157170'))?.definitions.flatMap(kept => kept.senses.map(sense => sense.glosses))).toEqual([['做'], ['存在']]);
        expect(await text.wordText('other')).toBeNull();
        expect(await text.wordText('plain')).not.toBeNull();
        // Only a word with a restricted sense has its forms read.
        expect(reads.vocab.mock.calls.map(([id]) => id).sort()).toEqual(['1157170', 'other']);
        expect(await text.wordIds()).toEqual(['1157170', 'plain']);
    });

    it('tells which of some ids have a page, in their order', async () => {
        const text = localeText('zh-hans', memoryReads({ one: [equivalent('a', 'reviewed')], two: [equivalent('b', 'rejected')], three: [equivalent('c', 'reviewed')] }));
        expect(await text.withPages(['three', 'unlisted', 'two', 'one'])).toEqual(['three', 'one']);
    });

    it('reads a word\'s file once, however often its text is asked (the catalog, then its page)', async () => {
        const reads = memoryReads({ one: [equivalent('a', 'reviewed')], two: [equivalent('b', 'rejected')] });
        const text = localeText('zh-hans', reads);
        expect(await text.wordIds()).toEqual(['one']);
        expect(await text.wordText('one')).not.toBeNull();
        expect(await text.wordText('two')).toBeNull();
        expect(reads.file).toHaveBeenCalledTimes(2);
    });

    it('gives each word with a page its row gloss, cut short, read once', async () => {
        const reads = memoryReads({ one: [equivalent('a', 'reviewed')], two: [equivalent('b', 'rejected')] });
        const text = localeText('zh-hans', reads);
        expect(await text.wordSummary('one')).toBe('a');
        expect(await text.wordSummary('one')).toBe('a');
        expect(await text.wordSummary('two')).toBeNull();
        expect(await text.wordText('one')).not.toBeNull();
        expect(reads.file).toHaveBeenCalledTimes(2);
    });

    it('gives each word with a page its search gloss, only when its page shows that text, else its summary', async () => {
        const reads = memoryReads({
            listed: [equivalent('想', 'corroborated'), equivalent('认为', 'reviewed')],
            rejected: [equivalent('想', 'corroborated'), equivalent('思念', 'rejected')],
            another: [definition('suru', [{ glosses: ['做'] }, { glosses: ['印刷'], appliesToSpellings: ['刷る'] }])],
            unlisted: [equivalent('想', 'corroborated')],
            hidden: [equivalent('思念', 'rejected')],
        }, { another: forms('為る', 'する') }, { listed: '想，认为', rejected: '思念', another: '印刷', hidden: '思念' });
        const text = localeText('zh-hans', reads);
        expect(await text.searchGloss('listed')).toBe('想，认为');
        // A gloss of a rejected rendering, or of a sense the page drops (another word's), is not the row's.
        expect(await text.searchGloss('rejected')).toBe('想');
        expect(await text.searchGloss('another')).toBe('做');
        expect(await text.searchGloss('unlisted')).toBe('想');
        // No page, no gloss, whatever the file lists.
        expect(await text.searchGloss('hidden')).toBeNull();
        expect(reads.glosses.mock.calls.map(([filePath]) => filePath)).toEqual([DATASET_PATHS.textSearchGlosses('zh-hans')]);
    });

    it('reads no file for a word or sentence set its index does not list', async () => {
        const reads = memoryReads({ shown: [equivalent('b', 'reviewed')] });
        const text = localeText('zh-hans', reads);
        expect(await text.wordText('unlisted')).toBeNull();
        expect((await text.sentenceTranslations('shown')).size).toBe(0);
        expect(reads.index.mock.calls.map(([filePath]) => filePath)).toEqual([DATASET_PATHS.textEntities('zh-hans')]);
        expect(reads.file).not.toHaveBeenCalled();
    });
});

describe('glossIsShown', () => {
    const word = { definitions: [definition('d', [{ glosses: ['想，认为'] }])], equivalents: [{ text: '想', sources: [] }, { text: '思考', sources: [] }] };

    it('accepts one of the word\'s shown glosses, or shown equivalents joined', () => {
        expect(glossIsShown('想，认为', word)).toBe(true);
        expect(glossIsShown('想，思考', word)).toBe(true);
        expect(glossIsShown('思考', word)).toBe(true);
    });

    it('refuses any text the word\'s page does not show', () => {
        expect(glossIsShown('认为', word)).toBe(false);
        expect(glossIsShown('想，思念', word)).toBe(false);
    });
});

describe('sentenceTranslationsOf', () => {
    it('gives each sentence its translation in the language, else its English, marked as English', () => {
        const own = { id: 't', role: 'translation' as const, source: { source: 'tatoeba-cmn', ref: '9' }, match: 'id' as const, status: 'imported' as const, value: '我也这么想。' };
        const sentences = [sentence({ id: 'a' }), sentence({ id: 'b' }), sentence({ id: 'c', en: [] })];
        expect(sentenceTranslationsOf(sentences, new Map([['a', own]]), 'zh-hans')).toEqual({
            a: { lang: 'zh-hans', text: '我也这么想。', source: { source: 'tatoeba-cmn', ref: '9' } },
            b: { lang: 'en', text: 'I think so.' },
        });
    });
});

describe('a Chinese word page', () => {
    it('carries no rendering isShown rejects, from the reader to the page model', async () => {
        const page = await pagesOf(checkoutData(FIXTURES, 'zh-hans'), 'zh-hans').vocabPage('1589350');
        expect(page.props.text?.definitions.map(definition => definition.source.source)).toEqual(['zhwiktionary']);
        expect(page.props.translations?.['1']).toEqual({ lang: 'zh-hans', text: '他认为。', source: { source: 'tatoeba-cmn', ref: '91' } });
        const model = JSON.stringify(page.props);
        for (const hidden of ['eq-rejected', '思念', 'eq-alone', '思量', 'tr-rejected', '他想念']) expect(model).not.toContain(hidden);
    });
});
