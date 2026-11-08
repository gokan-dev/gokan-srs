import { describe, expect, it } from 'vitest';
import { DATASET_PATHS } from './datasetPaths';

describe('DATASET_PATHS', () => {
    it('names an entity\'s file relative to compiled/, as it is published under /dataset/', () => {
        expect(DATASET_PATHS.vocab('1358280')).toBe('vocab/1358280.json');
        expect(DATASET_PATHS.sentences('1358280')).toBe('sentences/1358280.json');
        expect(DATASET_PATHS.kanjiOrder('kklc')).toBe('index/kanji-orders/kklc.json');
        expect(DATASET_PATHS.grammarPoint('n5-001')).toBe('grammar/points/n5-001.json');
        expect(DATASET_PATHS.grammarMinedExamples('n5-001')).toBe('grammar/mined/n5-001.json');
    });

    it('names every index as a JSON file under compiled/, never with a leading slash', () => {
        const indexes = Object.values(DATASET_PATHS).flatMap(path => (typeof path === 'string' ? [path] : []));
        expect(indexes.length).toBeGreaterThan(5);
        for (const path of indexes) expect(path).toMatch(/^[a-z][\w/-]*\.json$/);
    });
});
