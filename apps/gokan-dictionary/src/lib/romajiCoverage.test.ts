import { describe, it, expect } from 'vitest';
import { finishRomajiInput, kanaToRomaji, toHiragana } from '@gokan/dataset-schema';
import { checkoutData, resolveCompiledDir } from './dataset.server';
import type { DictionaryData } from './types';

// Every answer gokan-srs asks for in kana can be typed in romaji: its romaji, typed into a
// Japanese answer field (convertRomajiInput, settled on submit by finishRomajiInput), gives
// the reading back. Here rather than in gokan-srs because this app reads the compiled dataset
// from disk; a reading that fails is a gap in the romaji table to fix, never an exemption.
const data: DictionaryData = checkoutData(resolveCompiledDir());

function untypeable(readings: string[]): string[] {
    return readings.filter(reading => finishRomajiInput(kanaToRomaji(reading)) !== toHiragana(reading));
}

// Reading every vocab file (about 36k) is the whole cost; the check itself takes 0.1s. That is
// under the default 5s on Linux CI but 15s warm and near two minutes cold on Windows, where each
// file open is slow, and no single index carries the alternative readings. The timeout is a hang
// guard sized for that, not a loosening: every reading is still checked.
const WHOLE_DATASET_TIMEOUT_MS = 180_000;

describe('romaji input covers the dataset', () => {
    it('types every word reading', { timeout: WHOLE_DATASET_TIMEOUT_MS }, async () => {
        const words = await Promise.all((await data.vocabIds()).map(id => data.vocab(id)));
        const readings = words.flatMap(({ reading }) => [reading.primary, ...reading.alternatives]);
        expect(readings.length).toBeGreaterThan(1000);
        expect(untypeable(readings)).toEqual([]);
    });

    it('types every conjugation drill answer in kana', async () => {
        const readings = Object.values(await data.grammarConjugations()).flatMap(entry => entry.items.map(item => item.targetReading));
        expect(readings.length).toBeGreaterThan(0);
        expect(untypeable(readings)).toEqual([]);
    });
});
