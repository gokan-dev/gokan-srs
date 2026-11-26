import { describe, it, expect } from 'vitest';
import { formsClassOf, headwordOf, type ConjugationClass } from '@gokan/dataset-schema';
import { checkoutData, resolveCompiledDir } from './dataset.server';
import type { DictionaryData } from './types';

// Every adjective's word page has its Forms table, in its own class (#278): an い-adjective's,
// いい's or a な-adjective's, a word tagged noun and な-adjective included. Read from the compiled
// dataset, as romajiCoverage.test.ts is; a word that fails is a gap in the rule table to fix.
const data: DictionaryData = checkoutData(resolveCompiledDir(), 'en');

const ADJECTIVE_CLASS: Record<string, ConjugationClass> = { 'adj-i': 'i-adj', 'adj-ix': 'i-adj-ii', 'adj-na': 'na-adj' };

// Reading every vocab file is the cost: the same hang guard as romajiCoverage.test.ts's, sized for Windows.
const WHOLE_DATASET_TIMEOUT_MS = 180_000;

describe('Forms covers every adjective', () => {
    it('gives every adjective its own class\'s table', { timeout: WHOLE_DATASET_TIMEOUT_MS }, async () => {
        let adjectives = 0;
        const wrong: string[] = [];
        for (const id of await data.vocabIds()) {
            const vocab = await data.vocab(id);
            const pos = vocab.senses.flatMap(sense => sense.pos);
            const tag = pos.find(tag => Object.hasOwn(ADJECTIVE_CLASS, tag));
            if (tag === undefined) continue;
            adjectives++;
            const found = formsClassOf(headwordOf(vocab), pos);
            if (found !== ADJECTIVE_CLASS[tag]) wrong.push(`${id} ${headwordOf(vocab)}: ${found ?? 'no table'}, not ${ADJECTIVE_CLASS[tag]}`);
        }
        expect(adjectives).toBeGreaterThan(1000);
        expect(wrong).toEqual([]);
    });
});
