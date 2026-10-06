import { describe, it, expect, afterEach, vi } from 'vitest';
import { VocabularyService, VocabNotFoundError } from './vocabulary.service';

// Minimal Response stub for loadVocab's checks (status, ok, content-type, json()).
function res(opts: { status?: number; ok?: boolean; contentType?: string; json?: () => unknown }): Response {
    const status = opts.status ?? 200;
    return {
        status,
        ok: opts.ok ?? (status >= 200 && status < 300),
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? (opts.contentType ?? 'application/json') : null) },
        json: opts.json ?? (async () => ({})),
    } as unknown as Response;
}

const vocab = (id: string) => ({
    id, writtenForm: { kanji: '日', alternatives: [], containedKanji: ['日'] },
    reading: { primary: 'ひ', alternatives: [] }, frequency: { kanjiRank: 1 },
    progression: { kklcStep: 1 }, senses: [],
});

afterEach(() => vi.restoreAllMocks());

describe('VocabularyService.loadVocab not-found detection', () => {
    it('returns the vocab on a normal JSON response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ json: async () => vocab('100') }));
        expect((await VocabularyService.loadVocab('100')).id).toBe('100');
    });

    it('throws VocabNotFoundError on a 404 (dev server / true origin 404)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 404 }));
        await expect(VocabularyService.loadVocab('404id')).rejects.toBeInstanceOf(VocabNotFoundError);
    });

    it('throws VocabNotFoundError on a 200 text/html (prod CloudFront SPA fallback for a missing key)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 200, contentType: 'text/html', json: async () => { throw new Error('<'); } }));
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
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ status: 200, json: async () => { throw new SyntaxError('bad'); } }));
        await expect(VocabularyService.loadVocab('corrupt')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });

    it('propagates a transient network error (NOT VocabNotFoundError) so a blip never retires a word', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(VocabularyService.loadVocab('offline')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });
});
