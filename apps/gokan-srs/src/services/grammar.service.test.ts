import { describe, it, expect, vi, afterEach } from 'vitest';
import { GrammarService } from './grammar.service';
import type { GrammarExample } from '@gokan/dataset-schema';

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

describe('GrammarService.loadMinedExamples', () => {
    it('returns the parsed examples on a successful fetch', async () => {
        const examples = [makeExample()];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(examples),
        }));

        const result = await GrammarService.loadMinedExamples('n5-001');
        expect(result).toEqual(examples);
    });

    it('caches the result - a second call does not fetch again', async () => {
        const examples = [makeExample()];
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(examples),
        });
        vi.stubGlobal('fetch', fetchMock);

        await GrammarService.loadMinedExamples('n5-001');
        await GrammarService.loadMinedExamples('n5-001');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null on a 404 (the common case - most points have no mined pool)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        }));

        const result = await GrammarService.loadMinedExamples('n5-999');
        expect(result).toBeNull();
    });

    it('caches a 404 - a second call for the same id does not re-fetch', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
        vi.stubGlobal('fetch', fetchMock);

        await GrammarService.loadMinedExamples('n5-999');
        await GrammarService.loadMinedExamples('n5-999');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null (without caching) on a non-404 error, so a later call can retry', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
            .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([makeExample()]) });
        vi.stubGlobal('fetch', fetchMock);

        const first = await GrammarService.loadMinedExamples('n5-002');
        expect(first).toBeNull();

        const second = await GrammarService.loadMinedExamples('n5-002');
        expect(second).toEqual([makeExample()]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
