import { describe, expect, it } from 'vitest';
import {
    CLOSE_DELAY_MS,
    OPEN_DELAY_MS,
    cardPresentation,
    clickAction,
    headwordGlyphs,
    lookupReducer,
    pendingDelay,
    placePopover,
    type LookupEvent,
    type LookupPhase,
} from './lookup.utils';

const run = (events: LookupEvent['type'][], from: LookupPhase = 'closed'): LookupPhase =>
    events.reduce<LookupPhase>((phase, type) => lookupReducer(phase, { type }), from);

describe('clickAction', () => {
    it('follows a link trigger on every pointer', () => {
        expect(clickAction('link', 'hover')).toBe('follow');
        expect(clickAction('link', 'touch')).toBe('follow');
    });

    it('pins an inline trigger with a mouse and opens the sheet on touch', () => {
        expect(clickAction('inline', 'hover')).toBe('pin');
        expect(clickAction('inline', 'touch')).toBe('sheet');
    });
});

describe('lookupReducer', () => {
    it('opens after the delay over the trigger, not before', () => {
        expect(run(['enter'])).toBe('opening');
        expect(pendingDelay('opening')).toBe(OPEN_DELAY_MS);
        expect(cardPresentation('opening')).toBeNull();
        expect(run(['enter', 'elapsed'])).toBe('open');
        expect(cardPresentation('open')).toBe('popover');
    });

    it('opens nothing when the pointer only passes over', () => {
        expect(run(['enter', 'leave'])).toBe('closed');
    });

    it('keeps the card for the grace period after leaving, and while the pointer moves onto it', () => {
        expect(run(['enter', 'elapsed', 'leave'])).toBe('closing');
        expect(pendingDelay('closing')).toBe(CLOSE_DELAY_MS);
        expect(cardPresentation('closing')).toBe('popover');
        expect(run(['enter', 'elapsed', 'leave', 'enter'])).toBe('open');
        expect(run(['enter', 'elapsed', 'leave', 'elapsed'])).toBe('closed');
    });

    it('keeps a pinned card whatever the pointer does, until dismissed', () => {
        expect(run(['pin'])).toBe('pinned');
        expect(run(['enter', 'elapsed', 'pin', 'leave', 'elapsed'])).toBe('pinned');
        expect(pendingDelay('pinned')).toBeNull();
        expect(run(['pin', 'dismiss'])).toBe('closed');
    });

    it('shows the touch card as a sheet until it is closed', () => {
        expect(run(['tap'])).toBe('sheet');
        expect(cardPresentation('sheet')).toBe('sheet');
        expect(run(['tap', 'leave', 'elapsed', 'pin'])).toBe('sheet');
        expect(run(['tap', 'dismiss'])).toBe('closed');
    });

    it('closes from every phase on dismiss', () => {
        const phases: LookupPhase[] = ['closed', 'opening', 'open', 'closing', 'pinned', 'sheet'];
        for (const phase of phases) expect(lookupReducer(phase, { type: 'dismiss' })).toBe('closed');
    });
});

describe('headwordGlyphs', () => {
    it('splits the kanji out of a headword, keeping the kana between as text', () => {
        expect(headwordGlyphs('食べ物', ['食', '物'])).toEqual([
            { text: '食', kanji: true },
            { text: 'べ', kanji: false },
            { text: '物', kanji: true },
        ]);
    });

    it('leaves a kana headword as one run', () => {
        expect(headwordGlyphs('ここ', [])).toEqual([{ text: 'ここ', kanji: false }]);
    });
});

describe('placePopover', () => {
    const card = { width: 200, height: 80 };

    it('centres the card above its trigger', () => {
        expect(placePopover({ left: 300, top: 400, bottom: 420, width: 40 }, card, 1280)).toEqual({ left: 220, top: 312 });
    });

    it('clamps the card into the viewport at either edge', () => {
        expect(placePopover({ left: 0, top: 400, bottom: 420, width: 20 }, card, 320).left).toBe(8);
        expect(placePopover({ left: 300, top: 400, bottom: 420, width: 20 }, card, 320).left).toBe(112);
    });

    it('goes below a trigger with no room above it', () => {
        expect(placePopover({ left: 300, top: 40, bottom: 60, width: 40 }, card, 1280).top).toBe(68);
    });
});
