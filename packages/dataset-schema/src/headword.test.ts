import { describe, expect, it } from 'vitest';
import { headwordOf, headwordWithReading, searchHeadword, searchSecondaryForm, secondaryForm } from './headword';

describe('headwordOf', () => {
    const here = { writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] }, reading: { primary: 'ここ', alternatives: [] } };

    it('names a word learned in kana by its reading', () => {
        expect(headwordOf({ ...here, usuallyKana: true })).toBe('ここ');
    });

    it('names any other word by its kanji spelling', () => {
        expect(headwordOf(here)).toBe('此処');
    });
});

describe('headwordWithReading', () => {
    const here = { writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] }, reading: { primary: 'ここ', alternatives: [] } };

    it('adds the reading to a kanji headword, and nothing to a kana one', () => {
        expect(headwordWithReading(here)).toBe('此処 (ここ)');
        expect(headwordWithReading({ ...here, usuallyKana: true })).toBe('ここ');
    });
});

describe('secondaryForm', () => {
    const here = { writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] }, reading: { primary: 'ここ', alternatives: [] } };

    it('is the reading beside a kanji headword, and the kanji spelling beside a kana one', () => {
        expect(secondaryForm(here)).toBe('ここ');
        expect(secondaryForm({ ...here, usuallyKana: true })).toBe('此処');
    });
});

describe('searchHeadword / searchSecondaryForm', () => {
    it('follow the row\'s usually-kana mark', () => {
        expect(searchHeadword({ w: '此処', r: 'ここ', u: true })).toBe('ここ');
        expect(searchSecondaryForm({ w: '此処', r: 'ここ', u: true })).toBe('此処');
        expect(searchHeadword({ w: '日本', r: 'にほん' })).toBe('日本');
        expect(searchSecondaryForm({ w: '日本', r: 'にほん' })).toBe('にほん');
    });
});
