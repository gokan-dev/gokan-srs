import { describe, it, expect, vi, afterEach } from 'vitest';
import { GrammarService } from './grammar.service';
import type { GrammarExample } from '@gokan/dataset-schema';
import { datasetPathOf, emptyEnglishText, englishFiles } from '../test/datasetFiles';

function makeExample(overrides: Partial<GrammarExample> = {}): GrammarExample {
    return {
        jp: '本を読みます。',
        romaji: 'hon wo yomimasu',
        en: 'I read a book.',
        patternWordIndices: [1],
        words: [
            { surface: '本', vocabId: 'v-hon', reading: 'ほん' },
            { surface: 'を', vocabId: null },
            { surface: '読み', vocabId: 'v-yomu', reading: 'よみ' },
            { surface: 'ます', vocabId: null },
            { surface: '。', vocabId: null },
        ],
        ...overrides,
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // GrammarService caches on the class itself, so each test starts from an empty cache.
    GrammarService.clearCache();
});

/** The published files a test serves: a request for any other is a 404. */
function publishedFetch(files: Record<string, unknown>, status = () => 200) {
    return vi.fn((url: string) => {
        const path = datasetPathOf(url);
        if (status() !== 200) return Promise.resolve(new Response('', { status: status(), statusText: 'Server Error' }));
        return Promise.resolve(Object.hasOwn(files, path)
            ? new Response(JSON.stringify(files[path]))
            : new Response('', { status: 404, statusText: 'Not Found' }));
    });
}

/** A point's mined examples as published: their core and their English text. */
const minedFiles = (id: string, examples: GrammarExample[]) => ({
    [`grammar/mined/${id}.json`]: examples.map(({ en: _en, ...core }) => core),
    [`text/en/grammar/mined/${id}.json`]: emptyEnglishText(),
});

/** What the app makes of published files, by the loader's own projection. */
const english = async (files: Record<string, unknown>, path: string) =>
    (await englishFiles<unknown>(Object.fromEntries(Object.entries(files).map(([key, value]) => [`dataset/compiled/${key}`, value]))))[path];

describe('GrammarService.loadMinedExamples', () => {
    it('returns the examples, each with its English, on a successful fetch', async () => {
        const files = minedFiles('n5-001', [makeExample()]);
        vi.stubGlobal('fetch', publishedFetch(files));

        const result = await GrammarService.loadMinedExamples('n5-001');
        expect(result).toEqual(await english(files, 'grammar/mined/n5-001.json'));
        expect(result?.[0].words).toEqual(makeExample().words);
    });

    it('caches the result - a second call does not fetch again', async () => {
        const fetchMock = publishedFetch(minedFiles('n5-001', [makeExample()]));
        vi.stubGlobal('fetch', fetchMock);

        await GrammarService.loadMinedExamples('n5-001');
        await GrammarService.loadMinedExamples('n5-001');

        // Its core and its English text, once each.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns null on a 404 (the common case - most points have no mined pool)', async () => {
        vi.stubGlobal('fetch', publishedFetch({}));

        const result = await GrammarService.loadMinedExamples('n5-999');
        expect(result).toBeNull();
    });

    it('caches a 404 - a second call for the same id does not re-fetch', async () => {
        const fetchMock = publishedFetch({});
        vi.stubGlobal('fetch', fetchMock);

        await GrammarService.loadMinedExamples('n5-999');
        await GrammarService.loadMinedExamples('n5-999');

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns null (without caching) on a non-404 error, so a later call can retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let status = 500;
        const files = minedFiles('n5-002', [makeExample()]);
        const fetchMock = publishedFetch(files, () => status);
        vi.stubGlobal('fetch', fetchMock);

        const first = await GrammarService.loadMinedExamples('n5-002');
        expect(first).toBeNull();

        status = 200;
        const second = await GrammarService.loadMinedExamples('n5-002');
        expect(second).toEqual(await english(files, 'grammar/mined/n5-002.json'));
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});

describe('GrammarService index loaders', () => {
    const okJson = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));
    const teachingOrder = { order: ['a'], chapters: [{ id: 'c', points: ['a'] }] };

    it('download each index once when callers ask at the same moment', async () => {
        const fetchMock = vi.fn((url: string) => {
            const path = datasetPathOf(url);
            return okJson(path.startsWith('text/en/') ? emptyEnglishText() : path.includes('teaching-order') ? teachingOrder : {});
        });
        vi.stubGlobal('fetch', fetchMock);

        await Promise.all([
            GrammarService.loadTeachingOrder(), GrammarService.loadTeachingOrder(),
            GrammarService.loadKinds(), GrammarService.loadKinds(),
            GrammarService.loadConjugations(), GrammarService.loadConjugations(), GrammarService.loadConjugations(),
        ]);

        // The teaching order and the conjugations with their English text, the kinds alone.
        expect(fetchMock.mock.calls.map(([url]) => datasetPathOf(url)).sort()).toEqual([
            'grammar/conjugations.json', 'grammar/index/kinds.json', 'grammar/index/teaching-order.json',
            'text/en/grammar/conjugations.json', 'text/en/grammar/index/teaching-order.json',
        ]);
    });

    it('keep their failure results, and retry after a failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        expect(await GrammarService.loadTeachingOrder()).toBeNull();
        expect(await GrammarService.loadKinds()).toEqual({});
        expect(await GrammarService.loadConjugations()).toEqual({});

        const files = { 'grammar/conjugations.json': { 'n5-te': { marker: 'て', items: [] } }, 'text/en/grammar/conjugations.json': emptyEnglishText() };
        vi.stubGlobal('fetch', publishedFetch(files));
        const conjugations = await GrammarService.loadConjugations();
        expect(conjugations).toEqual(await english(files, 'grammar/conjugations.json'));
        expect(Object.keys(conjugations)).toEqual(['n5-te']);
    });
});
