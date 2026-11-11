import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../locale';
import { enSearch } from './en';
import { searchMessagesFor } from './index';
import { zhHansSearch } from './zh-hans';

describe('searchMessagesFor', () => {
    it('gives every locale its own words', () => {
        expect(searchMessagesFor('en')).toBe(enSearch);
        expect(searchMessagesFor('zh-hans')).toBe(zhHansSearch);
        expect(new Set(LOCALES.map(searchMessagesFor)).size).toBe(LOCALES.length);
    });
});
