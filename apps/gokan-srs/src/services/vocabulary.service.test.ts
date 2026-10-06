import { describe, it, expect, afterEach, vi } from 'vitest';
import { VocabularyService, VocabNotFoundError } from './vocabulary.service';

// Minimal Response stub for loadVocab's checks (ok, content-type, json()).
function res(opts: { ok?: boolean; contentType?: string; json?: () => unknown }): Response {
    return {
        ok: opts.ok ?? true,
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

    it('throws VocabNotFoundError on a 404 (dev server)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ ok: false }));
        await expect(VocabularyService.loadVocab('404id')).rejects.toBeInstanceOf(VocabNotFoundError);
    });

    it('throws VocabNotFoundError on a 200 text/html (prod CloudFront SPA fallback)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ ok: true, contentType: 'text/html', json: async () => { throw new Error('<'); } }));
        await expect(VocabularyService.loadVocab('spa')).rejects.toBeInstanceOf(VocabNotFoundError);
    });

    it('throws VocabNotFoundError when the body is not valid JSON', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ ok: true, json: async () => { throw new SyntaxError('bad'); } }));
        await expect(VocabularyService.loadVocab('badjson')).rejects.toBeInstanceOf(VocabNotFoundError);
    });

    it('propagates a transient network error (NOT VocabNotFoundError) so a blip never retires a word', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(VocabularyService.loadVocab('offline')).rejects.not.toBeInstanceOf(VocabNotFoundError);
    });
});
