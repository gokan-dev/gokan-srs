import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    listVocabIds,
    loadVocab,
    loadKanjiList,
    loadKanjiVocabIndex,
    loadSentences,
    loadSearchIndex,
    loadGrammarMinedExamples,
} from './dataset.server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'compiled');

describe('listVocabIds', () => {
    it('lists vocab ids from the vocab/ directory, stripping .json', () => {
        expect(listVocabIds(FIXTURES_DIR)).toEqual(['1589350']);
    });
});

describe('loadVocab', () => {
    it('loads and parses a vocab file by id', () => {
        const vocab = loadVocab(FIXTURES_DIR, '1589350');
        expect(vocab.id).toBe('1589350');
        expect(vocab.writtenForm.kanji).toBe('思う');
        expect(vocab.senses[0].glosses).toContain('to think');
    });
});

describe('loadKanjiList', () => {
    it('loads the flat kanji array', () => {
        const kanji = loadKanjiList(FIXTURES_DIR);
        expect(kanji).toHaveLength(2);
        expect(kanji.map(k => k.character)).toEqual(['思', '日']);
    });
});

describe('loadKanjiVocabIndex', () => {
    it('loads the kanji -> vocabIds reverse index', () => {
        const index = loadKanjiVocabIndex(FIXTURES_DIR);
        expect(index['思']).toEqual(['1589350']);
        expect(index['日']).toEqual([]);
    });
});

describe('loadSentences', () => {
    it('loads sentences for a vocab id that has them', () => {
        const sentences = loadSentences(FIXTURES_DIR, '1589350');
        expect(sentences).not.toBeNull();
        expect(sentences![0].original).toBe('彼は思う。');
    });

    it('returns null for a vocab id with no sentence file', () => {
        expect(loadSentences(FIXTURES_DIR, '9999999')).toBeNull();
    });
});

describe('loadSearchIndex', () => {
    it('loads the compact search index', () => {
        const index = loadSearchIndex(FIXTURES_DIR);
        expect(index).toEqual([{ id: '1589350', w: '思う', r: 'おもう', m: 'to think, to consider' }]);
    });
});

describe('loadGrammarMinedExamples', () => {
    it('loads the corpus-mined example pool for a point that has one', () => {
        const examples = loadGrammarMinedExamples(FIXTURES_DIR, 'n5-001');
        expect(examples).not.toBeNull();
        expect(examples![0].jp).toBe('彼は思う。');
        expect(examples![0].words[2].vocabId).toBe('1589350');
    });

    it('returns null for a point with no mined pool', () => {
        expect(loadGrammarMinedExamples(FIXTURES_DIR, 'n5-999')).toBeNull();
    });
});
