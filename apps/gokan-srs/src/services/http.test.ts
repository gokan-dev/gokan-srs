import { describe, it, expect } from 'vitest';
import { datasetUrl } from './http';

describe('datasetUrl', () => {
    it('versions every dataset request with the dataset commit', () => {
        // Without the version, a browser keeps answering this URL from a cached older dataset.
        expect(datasetUrl('vocab/1002120.json')).toMatch(/^\/data\/compiled\/vocab\/1002120\.json\?v=[0-9a-f]{12}$/);
    });
});
