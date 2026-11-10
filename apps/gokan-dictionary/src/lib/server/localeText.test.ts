import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { Equivalent, Rendering, TextEntitiesIndex, TextFile, Value } from '@gokan/dataset-schema/text';
import { sentence } from '../../test/fixtures';
import { checkoutData } from '../dataset.server';
import { DATASET_PATHS } from '../datasetPaths';
import { localeText, sentenceTranslationsOf } from './localeText';
import { pagesOf } from './pages';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'compiled');

const equivalent = (id: string, status: Rendering['status'], source = 'jawiktionary', value: Value = id): Equivalent => (
    { id, role: 'equivalent', source: { source }, match: 'spelling+reading', status, value }
);

/** A language's text layer in memory: each word's renderings, its index listing every word given. */
function memoryReads(words: Record<string, Rendering[]>) {
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
        const converted = equivalent('c', 'corroborated', 'zhwiktionary', { value: '聪明', derivedFrom: { value: '聰明', lang: 'zh-hant', transform: 'script:hant-to-hans' } });
        const text = localeText('zh-hans', memoryReads({ word: [equivalent('a', 'corroborated', 'jawiktionary', '聪明'), converted, equivalent('智慧', 'reviewed')] }));
        expect((await text.wordText('word'))?.equivalents).toEqual([
            { text: '聪明', sources: [{ source: 'jawiktionary' }, { source: 'zhwiktionary' }] },
            { text: '智慧', sources: [{ source: 'jawiktionary' }] },
        ]);
    });

    it('reads a word\'s file once, however often its text is asked (the catalog, then its page)', async () => {
        const reads = memoryReads({ one: [equivalent('a', 'reviewed')], two: [equivalent('b', 'rejected')] });
        const text = localeText('zh-hans', reads);
        expect(await text.wordIds()).toEqual(['one']);
        expect(await text.wordText('one')).not.toBeNull();
        expect(await text.wordText('two')).toBeNull();
        expect(reads.file).toHaveBeenCalledTimes(2);
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
