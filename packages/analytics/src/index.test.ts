import { describe, expect, it } from 'vitest';
import { analyticsScriptTag, appVocabPath, DICTIONARY_PLACEMENTS, isDictionaryPlacement } from './index';

describe('analyticsScriptTag', () => {
    it('is empty when the build has no website id', () => {
        expect(analyticsScriptTag(undefined)).toBe('');
        expect(analyticsScriptTag('')).toBe('');
        expect(analyticsScriptTag('  ')).toBe('');
    });

    it('loads the Umami script deferred, with the website id, on the production host only', () => {
        expect(analyticsScriptTag(' 0b6c2a1e-4f7d-4c39-9d2a-6e1f5b8c3a90 ')).toBe(
            '<script defer src="https://cloud.umami.is/script.js" data-website-id="0b6c2a1e-4f7d-4c39-9d2a-6e1f5b8c3a90" data-domains="gokan-srs.com"></script>',
        );
    });

    it('rejects an id that is not a UUID instead of writing it into every page', () => {
        expect(() => analyticsScriptTag('"><script>')).toThrow('not a UUID');
        expect(() => analyticsScriptTag('abc-123')).toThrow('not a UUID');
    });
});

describe('DICTIONARY_PLACEMENTS', () => {
    it('lists each placement once, as a plain utm_content value', () => {
        expect(new Set(DICTIONARY_PLACEMENTS).size).toBe(DICTIONARY_PLACEMENTS.length);
        for (const placement of DICTIONARY_PLACEMENTS) expect(placement).toMatch(/^[a-z]+$/);
    });

    it('recognises only a listed placement', () => {
        expect(isDictionaryPlacement('range')).toBe(true);
        expect(isDictionaryPlacement('sidebar')).toBe(false);
        expect(isDictionaryPlacement('')).toBe(false);
        expect(isDictionaryPlacement(null)).toBe(false);
    });
});

describe('appVocabPath', () => {
    it('is the app\'s word route, the id encoded', () => {
        expect(appVocabPath('1358280')).toBe('/vocab/1358280');
        expect(appVocabPath('a/b c')).toBe('/vocab/a%2Fb%20c');
    });
});
