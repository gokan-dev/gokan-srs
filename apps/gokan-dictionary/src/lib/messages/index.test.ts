import { describe, expect, it } from 'vitest';
import { SERVED_LOCALES } from '../locale';
import { en } from './en';
import { messagesFor, type Messages } from './index';

describe('messagesFor', () => {
    it('has a catalog for every served locale', () => {
        for (const locale of SERVED_LOCALES) expect(messagesFor(locale)).toBeDefined();
        expect(messagesFor('en')).toBe(en);
    });

    it('refuses, at build, a catalog missing a key', () => {
        // Typecheck runs over the tests: were a missing key ever accepted, this directive would
        // have no error to expect, and typecheck would fail on it.
        const { skipLink: _dropped, ...chromeWithoutSkipLink } = en.chrome;
        // @ts-expect-error -- `chrome.skipLink` is missing: a locale's catalog must say everything English says.
        const incomplete: Messages = { ...en, chrome: chromeWithoutSkipLink };
        expect(incomplete.chrome).not.toHaveProperty('skipLink');
    });
});
