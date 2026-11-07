import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, PUBLISHED_LANGUAGES, isPublishedDatasetFile, publishedDatasetFile } from './publishedDataset';

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

describe('publishedDatasetFile', () => {
    it('reads a published file under /dataset/', () => {
        expect(publishedDatasetFile('/dataset/vocab/1358280.json')).toBe('vocab/1358280.json');
        expect(publishedDatasetFile('/dataset/text/en/kanji/学.json')).toBe('text/en/kanji/学.json');
    });

    it('answers nothing outside /dataset/, or for a file the deploy does not publish', () => {
        expect(publishedDatasetFile('/data/compiled/vocab/1358280.json')).toBeNull();
        expect(publishedDatasetFile('/dataset/text/zh-hans/vocab/1358280.json')).toBeNull();
        expect(publishedDatasetFile('/dataset/merged_vocabs.log')).toBeNull();
    });

    it('never leaves compiled/', () => {
        expect(publishedDatasetFile('/dataset/../package.json')).toBeNull();
        expect(publishedDatasetFile('/dataset/vocab/../../x.json')).toBeNull();
        expect(publishedDatasetFile('/dataset/')).toBeNull();
    });
});
