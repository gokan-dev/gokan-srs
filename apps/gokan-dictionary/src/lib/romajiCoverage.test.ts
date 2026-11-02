import { describe, it, expect } from 'vitest';
import { finishRomajiInput, kanaToRomaji, toHiragana } from '@gokan/dataset-schema';
import { listVocabIds, loadGrammarConjugations, loadVocab, resolveCompiledDir } from './dataset.server';

// Every answer gokan-srs asks for in kana can be typed in romaji: its romaji, typed into a
// Japanese answer field (convertRomajiInput, settled on submit by finishRomajiInput), gives
// the reading back. Here rather than in gokan-srs because this app reads the compiled dataset
// from disk; a reading that fails is a gap in the romaji table to fix, never an exemption.
const compiledDir = resolveCompiledDir();

function untypeable(readings: string[]): string[] {
    return readings.filter(reading => finishRomajiInput(kanaToRomaji(reading)) !== toHiragana(reading));
}

describe('romaji input covers the dataset', () => {
    it('types every word reading', () => {
        const readings = listVocabIds(compiledDir).flatMap(id => {
            const { reading } = loadVocab(compiledDir, id);
            return [reading.primary, ...reading.alternatives];
        });
        expect(readings.length).toBeGreaterThan(1000);
        expect(untypeable(readings)).toEqual([]);
    });

    it('types every conjugation drill answer in kana', () => {
        const readings = Object.values(loadGrammarConjugations(compiledDir)).flatMap(entry => entry.items.map(item => item.targetReading));
        expect(readings.length).toBeGreaterThan(0);
        expect(untypeable(readings)).toEqual([]);
    });
});
