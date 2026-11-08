import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkoutData } from './dataset.server';
import type { DictionaryData } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'compiled');
const data: DictionaryData = checkoutData(FIXTURES_DIR, 'en');

describe('vocabIds', () => {
    it('lists vocab ids from the vocab/ directory, stripping .json', async () => {
        expect(await data.vocabIds()).toEqual(['1589350']);
    });
});

describe('vocab', () => {
    it('loads a vocab file by id, with its English senses from the text layer', async () => {
        const vocab = await data.vocab('1589350');
        expect(vocab.id).toBe('1589350');
        expect(vocab.writtenForm.kanji).toBe('思う');
        expect(vocab.senses[0].glosses).toContain('to think');
    });

    it('rejects for an id with no file, rather than throwing', async () => {
        const missing = data.vocab('9999999');
        await expect(missing).rejects.toThrow(/9999999/);
    });
});

describe('wordSummaries', () => {
    it('gives every word as other pages list it, by id', async () => {
        const summaries = await data.wordSummaries();
        expect([...summaries.keys()]).toEqual(['1589350']);
        const summary = summaries.get('1589350');
        expect(summary).toMatchObject({ id: '1589350', word: '思う' });
        expect(summary?.gloss).toContain('to think');
    });

    it('builds the index once', async () => {
        expect(await data.wordSummaries()).toBe(await data.wordSummaries());
    });
});

describe('kanjiList', () => {
    it('loads the flat kanji array', async () => {
        const kanji = await data.kanjiList();
        expect(kanji).toHaveLength(2);
        expect(kanji.map(k => k.character)).toEqual(['思', '日']);
    });
});

describe('kanjiVocabIndex', () => {
    it('loads the kanji -> vocabIds reverse index', async () => {
        const index = await data.kanjiVocabIndex();
        expect(index['思']).toEqual(['1589350']);
        expect(index['日']).toEqual([]);
    });
});

describe('kanjiOrder', () => {
    it("loads an order's kanji in teaching order", async () => {
        expect(await data.kanjiOrder('kklc')).toEqual(['一', '日', '学', '生']);
    });
});

describe('sentencesFor', () => {
    it('loads sentences for a vocab id that has them', async () => {
        const sentences = await data.sentencesFor('1589350');
        expect(sentences).not.toBeNull();
        expect(sentences![0].original).toBe('彼は思う。');
        expect(sentences![0].en).toEqual([{ id: '1', text: 'He thinks.' }]);
    });

    it('returns null for a vocab id with no sentence file', async () => {
        expect(await data.sentencesFor('9999999')).toBeNull();
    });
});

describe('frequencyIndex', () => {
    it('loads the frequency-ordered vocab ids', async () => {
        expect(await data.frequencyIndex()).toEqual([{ id: '1589350', containedKanji: ['思'] }]);
    });
});

describe('grammarMinedExamples', () => {
    it('loads the corpus-mined example pool for a point that has one', async () => {
        const examples = await data.grammarMinedExamples('n5-001');
        expect(examples).not.toBeNull();
        expect(examples![0].jp).toBe('彼は思う。');
        expect(examples![0].words[2].vocabId).toBe('1589350');
        expect(examples![0].en).toBe('He thinks.');
    });

    it('returns null for a point with no mined pool', async () => {
        expect(await data.grammarMinedExamples('n5-999')).toBeNull();
    });
});
