import { describe, it, expect, afterEach, vi } from 'vitest';
import { VocabularyService, VocabNotFoundError } from './vocabulary.service';
import { vocabulary } from '../test/fixtures';

/** A real Response, so loadVocab's status, content-type and body handling run unmodified. */
function res(opts: { status?: number; contentType?: string; body?: string }): Response {
    return new Response(opts.body ?? '{}', {
        status: opts.status ?? 200,
        headers: { 'content-type': opts.contentType ?? 'application/json' },
    });
}

const vocabBody = (id: string) => JSON.stringify(vocabulary({ id }));

afterEach(() => vi.restoreAllMocks());

describe('VocabularyService.loadVocab not-found detection', () => {
    it('returns the vocab on a normal JSON response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ body: vocabBody('100') }));
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
