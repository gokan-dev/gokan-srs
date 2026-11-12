import { describe, expect, it } from 'vitest';
import { DICTIONARY_BASE_PATH } from '@gokan/dataset-schema';
import { configuredBasePath } from './configuredBasePath';

describe('configuredBasePath', () => {
    it('is the shared host prefix when nothing is configured', () => {
        expect(configuredBasePath(undefined)).toBe(DICTIONARY_BASE_PATH);
    });

    it('is empty for a site served from the root of its own origin', () => {
        expect(configuredBasePath('')).toBe('');
        expect(configuredBasePath('/')).toBe('');
    });

    it('gives a leading slash and no trailing one', () => {
        expect(configuredBasePath('dictionary')).toBe('/dictionary');
        expect(configuredBasePath('/dictionary/')).toBe('/dictionary');
        expect(configuredBasePath('/a/b')).toBe('/a/b');
    });
});