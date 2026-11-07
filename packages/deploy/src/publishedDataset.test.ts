import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, PUBLISHED_LANGUAGES, isPublishedDatasetFile } from './publishedDataset';

describe('isPublishedDatasetFile', () => {
    it('publishes every core file', () => {
        for (const file of ['vocab/1358280.json', 'kanji.json', 'sentences/1358280.json', 'grammar/points/n5-001.json', 'index/search.json', 'schemas/vocab.schema.json', 'datapackage.json']) {
            expect(isPublishedDatasetFile(file), file).toBe(true);
        }
    });

    it('publishes the text of a language an app reads, and no other', () => {
        expect(isPublishedDatasetFile('text/en/vocab/1358280.json')).toBe(true);
        expect(isPublishedDatasetFile('text/zh-hans/vocab/1358280.json')).toBe(false);
        expect(isPublishedDatasetFile('text/fr/kanji/学.json')).toBe(false);
    });

    it('leaves out the build logs', () => {
        expect(isPublishedDatasetFile('merged_vocabs.log')).toBe(false);
        expect(isPublishedDatasetFile('sentence_matching.log')).toBe(false);
    });
});

describe('PUBLISHED_LANGUAGES', () => {
    it('is the union of the apps\' languages', () => {
        expect([...PUBLISHED_LANGUAGES].sort()).toEqual([...new Set(Object.values(APP_LANGUAGES).flat())].sort());
        expect(PUBLISHED_LANGUAGES.has('en')).toBe(true);
    });
});
