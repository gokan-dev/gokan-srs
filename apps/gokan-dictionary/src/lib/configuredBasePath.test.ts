import { describe, expect, it } from 'vitest';
import { DICTIONARY_BASE_PATH } from '@gokan/dataset-schema';
import { configuredBasePath, DEFAULT_BASE_PATH } from './configuredBasePath';

describe('configuredBasePath', () => {
    it('is the shared host prefix when nothing is configured, the one both apps link by', () => {
        expect(DEFAULT_BASE_PATH).toBe(DICTIONARY_BASE_PATH);
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