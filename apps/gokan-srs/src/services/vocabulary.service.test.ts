import { describe, it, expect, afterEach, vi } from 'vitest';
import { VocabularyService, VocabNotFoundError } from './vocabulary.service';
import { vocabulary } from '../test/fixtures';
import { datasetPathOf, emptyEnglishText } from '../test/datasetFiles';

/** A real Response, so loadVocab's status, content-type and body handling run unmodified. */
function res(opts: { status?: number; contentType?: string; body?: string }): Response {
    return new Response(opts.body ?? '{}', {
        status: opts.status ?? 200,
        headers: { 'content-type': opts.contentType ?? 'application/json' },
    });
}

const vocabBody = (id: string) => JSON.stringify(vocabulary({ id }));
/** A file's core answered with `body`, its English text (under text/en/) with an empty one. */
const withText = (body: string) => (url: string | URL | Request) =>
    Promise.resolve(res({ body: datasetPathOf(url).startsWith('text/en/') ? JSON.stringify(emptyEnglishText()) : body }));

afterEach(() => vi.restoreAllMocks());

describe('VocabularyService.loadVocab not-found detection', () => {
    it('returns the vocab on a normal JSON response', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(withText(vocabBody('100')));
        expect((await VocabularyService.loadVocab('100')).id).toBe('100');
    });

    it('throws VocabNotFoundError on a 404 (dev server / true origin 404)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 404 }));
        await expect(VocabularyService.loadVocab('404id')).rejects.toBeInstanceOf(VocabNotFoundError);
    });

    it('throws VocabNotFoundError on a 200 text/html (prod CloudFront SPA fallback for a missing key)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }));
        await expect(VocabularyService.loadVocab('spa')).rejects.toBeInstanceOf(VocabNotFoundError);
    });

    // The deploy-safety cases: a transient server/edge failure must NEVER retire a
    // legitimate word (retirement is a permanent tombstone). These stay recoverable
    // errors, not VocabNotFoundError.
    it('does NOT retire on a transient 503 (CloudFront/S3 hiccup or mid-deploy)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 503 }));
        await expect(VocabularyService.loadVocab('busy')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });

    it('does NOT retire on a 403', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 403 }));
        await expect(VocabularyService.loadVocab('forbidden')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });

    it('does NOT retire on a 200 with an unparseable JSON body (corruption, not absence)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 200, body: '{ not json' }));
        await expect(VocabularyService.loadVocab('corrupt')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });

    it('propagates a transient network error (NOT VocabNotFoundError) so a blip never retires a word', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(VocabularyService.loadVocab('offline')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });
});

describe('VocabularyService.loadSentences', () => {
    it("downloads a word's sentences once for two callers (the intro prefetch and the card's load)", async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(withText('[]'));

        const [a, b] = await Promise.all([VocabularyService.loadSentences('s1'), VocabularyService.loadSentences('s1')]);
        const later = await VocabularyService.loadSentences('s1');

        expect(a).toEqual([]);
        expect(b).toEqual([]);
        expect(later).toEqual([]);
        // Its core and its English text, each once.
        expect(fetchMock.mock.calls.map(([url]) => datasetPathOf(url)).sort()).toEqual(['sentences/s1.json', 'text/en/sentences/s1.json']);
    });

    it('gives null for a word with no sentence file (a 404 or the SPA fallback)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 404 }));
        expect(await VocabularyService.loadSentences('none404')).toBeNull();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 200, contentType: 'text/html', body: '<!doctype html>' }));
        expect(await VocabularyService.loadSentences('noneSpa')).toBeNull();
    });

    it('gives null on a transient failure without caching it, so a later call retries', async () => {
        let available = false;
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(url => (available ? withText('[]')(url) : Promise.resolve(res({ status: 503 }))));
        expect(await VocabularyService.loadSentences('flaky')).toBeNull();
        available = true;
        expect(await VocabularyService.loadSentences('flaky')).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});

describe('VocabularyService.loadFrequencyIndex', () => {
    it('downloads the index once when two callers ask at the same moment', async () => {
        // The hub's startup asked for it twice at once (usually-kana ids, more learnable words)
        // and each call started its own 3 MB download.
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(res({ body: '[]' })));

        const [a, b] = await Promise.all([VocabularyService.loadFrequencyIndex(), VocabularyService.loadUsuallyKanaIds()]);

        expect(a).toEqual([]);
        expect(b.size).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
