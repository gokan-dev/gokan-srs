import { describe, expect, it } from 'vitest';
import { CONSTANTS } from '../commons/constants';
import { initialOnboardingStep, parseSetupLink, setupCompletedEvent, withoutSetupParams } from './setupLink.utils';

describe('parseSetupLink', () => {
    it('reads the order and the count a range page links with', () => {
        expect(parseSetupLink('?order=rtk&known=500')).toEqual({ order: 'rtk', known: 500, source: 'direct' });
    });

    it('opens as without a link on an address with none', () => {
        expect(parseSetupLink('')).toEqual({ source: 'direct' });
    });

    it('ignores an order that is not one of the kanji orders', () => {
        expect(parseSetupLink('?order=heisig&known=20')).toEqual({ known: 20, source: 'direct' });
        expect(parseSetupLink('?order=&known=20')).toEqual({ known: 20, source: 'direct' });
    });

    it('ignores a count that is not a whole number', () => {
        for (const known of ['abc', '12.5', '-3', '', '1e3', '0x10']) {
            expect(parseSetupLink(`?order=kklc&known=${known}`)).toEqual({ order: 'kklc', source: 'direct' });
        }
    });

    it('keeps a count above the shortest order, for the kanji form to cap at the chosen one', () => {
        expect(parseSetupLink('?order=rtk&known=2800').known).toBe(2800);
        expect(parseSetupLink('?known=99999999999999999999').known).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('raises a count below the setup minimum to it', () => {
        expect(parseSetupLink('?known=0').known).toBe(CONSTANTS.setup.minimumKanjiCount);
    });

    it('names the dictionary placement the visitor came from', () => {
        expect(parseSetupLink('?order=kklc&known=300&utm_source=dictionary&utm_content=range').source).toBe('dictionary-range');
        expect(parseSetupLink('?utm_source=dictionary&utm_content=footer').source).toBe('dictionary-footer');
    });

    it('counts any other source as direct, so a stray value cannot invent one', () => {
        expect(parseSetupLink('?utm_source=dictionary&utm_content=sidebar').source).toBe('direct');
        expect(parseSetupLink('?utm_source=dictionary').source).toBe('direct');
        expect(parseSetupLink('?utm_source=newsletter&utm_content=range').source).toBe('direct');
    });
});

describe('withoutSetupParams', () => {
    it('removes the order and the count, and keeps the rest for Umami', () => {
        expect(withoutSetupParams('?order=kklc&known=300&utm_source=dictionary&utm_content=range'))
            .toBe('?utm_source=dictionary&utm_content=range');
    });

    it('leaves an address with nothing to remove as it was', () => {
        expect(withoutSetupParams('?order=kklc&known=300')).toBe('');
        expect(withoutSetupParams('')).toBe('');
    });
});

describe('setupCompletedEvent', () => {
    it('sends the source the link carried', () => {
        expect(setupCompletedEvent(parseSetupLink('?utm_source=dictionary&utm_content=word')))
            .toEqual({ name: 'setup_completed', data: { source: 'dictionary-word' } });
        expect(setupCompletedEvent(parseSetupLink('?order=rtk&known=500')))
            .toEqual({ name: 'setup_completed', data: { source: 'direct' } });
    });
});

describe('initialOnboardingStep', () => {
    it('opens on setup for a link with a kanji count, so the count it carries is in view', () => {
        expect(initialOnboardingStep(parseSetupLink('?order=kklc&known=103&utm_source=dictionary&utm_content=word'))).toBe('setup');
    });

    it('keeps the welcome for an order alone and for a direct visit', () => {
        expect(initialOnboardingStep(parseSetupLink('?order=kklc&utm_source=dictionary&utm_content=order'))).toBe('welcome');
        expect(initialOnboardingStep(parseSetupLink(''))).toBe('welcome');
    });
});
