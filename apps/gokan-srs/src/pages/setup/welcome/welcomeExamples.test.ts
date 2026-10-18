import { describe, it, expect } from 'vitest';
import { KANJI_ORDERS, type Sentence, type Vocabulary } from '@gokan/dataset-schema';
import { DEMO_START_KNOWN, DEMO_TILES, DEMO_WORDS, WELCOME_EXAMPLES, WELCOME_ORDER_IDS, demoAnswerIsRight } from './welcomeExamples';

// import.meta.glob rather than node:fs, which this tsconfig has no types for; each yields nothing
// when the dataset submodule is not checked out (ci.yml), so the dataset checks skip there.
const orderFiles = import.meta.glob<string[]>(
    '../../../../dataset/compiled/index/kanji-orders/*.json', { eager: true, import: 'default' }
);
const vocabFiles = import.meta.glob<Pick<Vocabulary, 'writtenForm' | 'reading'>>(
    '../../../../dataset/compiled/vocab/{1531710,1211510,1304970,1378860,1293990,1487660,1582710,1464700,1368370,1413240,1206900,1413260,1387990,1388300}.json',
    { eager: true, import: 'default' }
);
const sentenceFiles = import.meta.glob<Pick<Sentence, 'original' | 'matches'>[]>(
    '../../../../dataset/compiled/sentences/{1531710,1211510,1304970,1378860,1293990,1487660}.json',
    { eager: true, import: 'default' }
);
const datasetPresent = Object.keys(orderFiles).length > 0;

function file<T>(files: Record<string, T>, name: string): T {
    const key = Object.keys(files).find(path => path.endsWith(`/${name}.json`));
    if (key === undefined) throw new Error(`${name}.json is not in the compiled dataset`);
    return files[key];
}

describe('WELCOME_EXAMPLES', () => {
    it('leaves five orders off the chips, as step one\'s "and five more" says', () => {
        // A new order fails here until the approved copy in HowItWorks is updated with it.
        expect(KANJI_ORDERS.length - WELCOME_ORDER_IDS.length).toBe(5);
    });

    it('gives every chip an example whose first accepted answer is right', () => {
        for (const id of WELCOME_ORDER_IDS) {
            const example = WELCOME_EXAMPLES[id];
            expect(demoAnswerIsRight(example, example.accept[0]), id).toBe(true);
            expect(example.kanji.map(k => k.character).join(''), id).toBe(example.word);
        }
    });

    it.runIf(datasetPresent)('puts each kanji at its stated position, within the first 300 of the order', () => {
        for (const id of WELCOME_ORDER_IDS) {
            const order = file(orderFiles, id);
            for (const { character, position } of WELCOME_EXAMPLES[id].kanji) {
                expect(order.indexOf(character) + 1, `${id} ${character}`).toBe(position);
            }
            expect(Math.max(...WELCOME_EXAMPLES[id].kanji.map(k => k.position)), id).toBeLessThanOrEqual(300);
        }
    });

    it.runIf(datasetPresent)('spells and reads each word as its vocab file does, in one of its own sentences', () => {
        for (const id of WELCOME_ORDER_IDS) {
            const { vocabId, word, kana, before, after } = WELCOME_EXAMPLES[id];
            const vocab = file(vocabFiles, vocabId);
            expect(vocab.writtenForm.kanji, id).toBe(word);
            expect(vocab.reading.primary, id).toBe(kana);
            const sentence = file(sentenceFiles, vocabId).find(s => s.original === before + word + after);
            expect(sentence, id).toBeDefined();
            expect(sentence?.matches?.[vocabId]?.map(m => m.start), id).toContain(before.length);
        }
    });
});

describe('DEMO_WORDS', () => {
    it('are made only of the tiles, and the starting kanji are tiles', () => {
        const tiles = new Set<string>(DEMO_TILES);
        for (const { word } of DEMO_WORDS) expect([...word].every(ch => tiles.has(ch)), word).toBe(true);
        for (const ch of DEMO_START_KNOWN) expect(tiles.has(ch), ch).toBe(true);
    });

    it.runIf(datasetPresent)('spell and read each word as its vocab file does', () => {
        for (const { vocabId, word, kana } of DEMO_WORDS) {
            const vocab = file(vocabFiles, vocabId);
            expect(vocab.writtenForm.kanji, word).toBe(word);
            expect(vocab.reading.primary, word).toBe(kana);
        }
    });
});

describe('demoAnswerIsRight', () => {
    it('takes an answer containing an accepted one, ignoring case and spaces around it', () => {
        expect(demoAnswerIsRight({ accept: ['name'] }, '  My Name ')).toBe(true);
        expect(demoAnswerIsRight({ accept: ['name'] }, 'river')).toBe(false);
    });
});
