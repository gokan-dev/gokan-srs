import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { isPublishedDatasetFile } from '@gokan/deploy/published-dataset';
import { checkoutData } from '../dataset.server';
import { grammarSummaryOf, grammarSummaryOfRow } from '../grammarBrowse';
import { searchGrammarRow, searchKanjiRow, searchWordRow, splitSearchIndex } from '../searchIndex';
import type { DictionaryData, EntityData, SearchIndexFile } from '../types';
import { vocabSummaryFrom, vocabSummaryOfRow } from '../vocabSummary';
import { httpData } from './httpData';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, '..', '__fixtures__', 'compiled');
const COMPILED = path.join(here, '..', '..', '..', '..', 'gokan-srs', 'dataset', 'compiled');

const ORIGIN = 'https://site.test';
const SEARCH = { core: `${ORIGIN}/dictionary/data/search-core.json`, full: `${ORIGIN}/dictionary/data/search-full.json` };
const SPA_SHELL = () => new Response('<!doctype html><title>Gokan</title>', { headers: { 'content-type': 'text/html' } });

/**
 * The published dataset at `compiled` and the site's search index, as production serves them: a
 * file the dataset does not publish, or does not have, gets the SPA shell at 200 (CloudFront's
 * fallback), never a 404.
 */
function siteFetch(compiled: string, search: { core: SearchIndexFile; full: SearchIndexFile }) {
    return vi.fn((url: string) => {
        if (url === SEARCH.core) return Promise.resolve(Response.json(search.core));
        if (url === SEARCH.full) return Promise.resolve(Response.json(search.full));
        const { pathname } = new URL(url);
        const file = decodeURIComponent(pathname.slice('/dataset/'.length));
        if (!pathname.startsWith('/dataset/') || !isPublishedDatasetFile(file)) return Promise.resolve(SPA_SHELL());
        try {
            return Promise.resolve(new Response(readFileSync(path.join(compiled, file)), { headers: { 'content-type': 'application/json' } }));
        } catch {
            return Promise.resolve(SPA_SHELL());
        }
    });
}

const datasetUrl = (file: string) => `${ORIGIN}/dataset/${file}?v=test`;

async function wordsIndex(checkout: DictionaryData, grammarIds: readonly string[] = []) {
    const words = await Promise.all((await checkout.vocabIds()).map(id => checkout.vocab(id)));
    const points = await Promise.all(grammarIds.map(id => checkout.grammarPoint(id)));
    return splitSearchIndex(words.map(searchWordRow), (await checkout.kanjiList()).map(searchKanjiRow), points.map(searchGrammarRow));
}

/** Every EntityData answer the two sources must agree on, for the entities named. */
async function answers(source: EntityData, { words, kanjiOrders, minedFor }: { words: string[]; kanjiOrders: ('kklc' | 'rtk')[]; minedFor: string[] }) {
    return {
        vocab: await Promise.all(words.map(id => source.vocab(id))),
        sentences: await Promise.all([...words, '0000000'].map(id => source.sentencesFor(id))),
        summaries: [...(await source.wordSummaries())],
        kanji: await source.kanjiList(),
        kanjiVocab: await source.kanjiVocabIndex(),
        kanjiOrders: await Promise.all(kanjiOrders.map(order => source.kanjiOrder(order))),
        mined: await Promise.all([...minedFor, 'n9-999'].map(id => source.grammarMinedExamples(id))),
    };
}

describe('httpData', () => {
    it('answers as the checkout does for the same files (fixtures)', async () => {
        const checkout = checkoutData(FIXTURES, 'en');
        const fetch = siteFetch(FIXTURES, await wordsIndex(checkout));
        const over = httpData({ datasetUrl, searchIndexUrls: SEARCH, language: 'en', fetch });
        const asked = { words: ['1589350'], kanjiOrders: ['kklc' as const], minedFor: ['n5-001'] };

        expect(await answers(over, asked)).toEqual(await answers(checkout, asked));
        // Every dataset request carries the version; nothing reaches outside the site.
        for (const [url] of fetch.mock.calls) expect(url).toMatch(/^https:\/\/site\.test\/(dataset\/.+\?v=test|dictionary\/data\/search-(core|full)\.json)$/);
    });

    it('fetches each index once, however many pages ask', async () => {
        const checkout = checkoutData(FIXTURES, 'en');
        const fetch = siteFetch(FIXTURES, await wordsIndex(checkout));
        const over = httpData({ datasetUrl, searchIndexUrls: SEARCH, language: 'en', fetch });
        await Promise.all([over.wordSummaries(), over.wordSummaries(), over.kanjiList(), over.kanjiList()]);
        const requested = fetch.mock.calls.map(([url]) => url);
        expect(requested.filter(url => url === SEARCH.core)).toHaveLength(1);
        expect(requested.filter(url => url.startsWith(`${ORIGIN}/dataset/kanji.json`))).toHaveLength(1);
    });

    it('fails, rather than reading as an empty dictionary, when the search index is missing', async () => {
        const over = httpData({ datasetUrl, searchIndexUrls: SEARCH, language: 'en', fetch: () => Promise.resolve(SPA_SHELL()) });
        await expect(over.wordSummaries()).rejects.toThrow(/search-core\.json/);
    });

    it('answers as the checkout does for grammar points, over the real published dataset', async () => {
        const checkout = checkoutData(COMPILED, 'en');
        // A point with variants and mined examples, one with neither, and an N1 point.
        const ids = ['n5-001', 'n5-002', 'n4-010', 'n1-001'];
        const fetch = siteFetch(COMPILED, splitSearchIndex([], [], (await Promise.all((await checkout.grammarIds()).map(id => checkout.grammarPoint(id)))).map(searchGrammarRow)));
        const over = httpData({ datasetUrl, searchIndexUrls: SEARCH, language: 'en', fetch });
        const grammar = async (source: EntityData) => ({
            points: await Promise.all(ids.map(id => source.grammarPoint(id))),
            summaries: [...(await source.grammarSummaries())].sort(([a], [b]) => a.localeCompare(b)),
            order: await source.grammarTeachingOrder(),
            variants: await source.grammarVariantGroups(),
            conjugations: await source.grammarConjugations(),
            mined: await Promise.all(ids.map(id => source.grammarMinedExamples(id))),
        });
        expect(await grammar(over)).toEqual(await grammar(checkout));
    }, 60_000);
});

describe('summaries from search rows', () => {
    // Every word and point of the real dataset: the rows a page rendered on request lists other
    // entries from must say exactly what the prerendered pages say.
    const checkout = checkoutData(COMPILED, 'en');

    it('gives every word the summary its file gives', async () => {
        for (const id of await checkout.vocabIds()) {
            const vocab = await checkout.vocab(id);
            expect(vocabSummaryOfRow(searchWordRow(vocab)), id).toEqual(vocabSummaryFrom(vocab));
        }
    }, 300_000);

    it('gives every grammar point the summary its file gives', async () => {
        for (const id of await checkout.grammarIds()) {
            const point = await checkout.grammarPoint(id);
            expect(grammarSummaryOfRow(searchGrammarRow(point)), id).toEqual(grammarSummaryOf(point));
        }
    }, 60_000);
});
