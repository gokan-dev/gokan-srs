// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isCardReplay, isReplayKey } from './useQuizFocusManagement';

const key = (overrides: Partial<Parameters<typeof isReplayKey>[0]> = {}) =>
    ({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyR', ...overrides });

describe('isReplayKey', () => {
    it('is Alt+R by key position, whatever character Option+R types', () => {
        expect(isReplayKey(key())).toBe(true);
    });

    it('is not R alone (typed into the answer), nor with another modifier (AltGr is Ctrl+Alt)', () => {
        expect(isReplayKey(key({ altKey: false }))).toBe(false);
        expect(isReplayKey(key({ ctrlKey: true }))).toBe(false);
        expect(isReplayKey(key({ metaKey: true }))).toBe(false);
        expect(isReplayKey(key({ shiftKey: true }))).toBe(false);
        expect(isReplayKey(key({ code: 'KeyT' }))).toBe(false);
    });
});

describe('isCardReplay', () => {
    /** Alt+R dispatched from `target`, as the window listener receives it. */
    function pressFrom(target: Element): KeyboardEvent {
        let received: KeyboardEvent | null = null;
        const listen = (event: KeyboardEvent) => { received = event; };
        window.addEventListener('keydown', listen);
        target.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyR', bubbles: true, cancelable: true }));
        window.removeEventListener('keydown', listen);
        return received!;
    }

    it('replays from inside the card or from the page, never from an overlay over it', () => {
        const card = document.createElement('form');
        const input = document.createElement('input');
        card.appendChild(input);
        const overlay = document.createElement('div');
        document.body.append(card, overlay);

        expect(isCardReplay(pressFrom(input), card)).toBe(true);
        expect(isCardReplay(pressFrom(document.body), card)).toBe(true);
        expect(isCardReplay(pressFrom(overlay), card)).toBe(false);
        card.remove();
        overlay.remove();
    });

    it('leaves a press something else already handled', () => {
        const card = document.createElement('form');
        document.body.append(card);
        card.addEventListener('keydown', event => event.preventDefault());
        expect(isCardReplay(pressFrom(card), card)).toBe(false);
        card.remove();
    });
});
