import { describe, expect, it } from 'vitest';
import { analyticsScriptTag } from './index';

describe('analyticsScriptTag', () => {
    it('is empty when the build has no website id', () => {
        expect(analyticsScriptTag(undefined)).toBe('');
        expect(analyticsScriptTag('')).toBe('');
        expect(analyticsScriptTag('  ')).toBe('');
    });

    it('loads the Umami script deferred, with the website id', () => {
        expect(analyticsScriptTag(' 0b6c2a1e-4f7d-4c39-9d2a-6e1f5b8c3a90 ')).toBe(
            '<script defer src="https://cloud.umami.is/script.js" data-website-id="0b6c2a1e-4f7d-4c39-9d2a-6e1f5b8c3a90"></script>',
        );
    });

    it('rejects an id that is not a UUID instead of writing it into every page', () => {
        expect(() => analyticsScriptTag('"><script>')).toThrow('not a UUID');
        expect(() => analyticsScriptTag('abc-123')).toThrow('not a UUID');
    });
});
